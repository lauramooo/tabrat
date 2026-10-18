import { Platform } from 'react-native';
import type { ParsedReceipt } from '@/types';
import { fmtDate } from '@/utils/date';

// Keep in sync with supabase/functions/scan-receipt/index.ts — that Edge Function runs in Deno
// and can't import from here, so the prompt/model/retry logic is intentionally duplicated there
// for the shared-key path. If you change one, change the other.
const SYSTEM_PROMPT = `You are a receipt OCR parser. Read the receipt image carefully and extract all data.

Return ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "restaurantName": "string or null",
  "receiptDate": "string or null",
  "items": [{"name": "string", "price": number, "quantity": number, "modifiers": ["string", ...]}],
  "subtotal": number,
  "tax": number,
  "tip": number,
  "extraCharges": [{"name": "string", "amount": number, "isDiscount": boolean}],
  "total": number
}

Rules:
- restaurantName: the business/restaurant name printed on the receipt. null if not visible.
- receiptDate: the date on the receipt in readable format e.g. "Jun 18, 2026". null if absent.
- items: ONLY food, drink, or retail line items — never subtotal, tax, tip, gratuity, fees, discounts, or total as items.
- Sub-lines and modifiers (e.g. an indented "with fries", "no onions", "add cheese +$2" printed directly under an item) belong to that item, NOT their own item — never give them their own entry in "items", not even at $0. Keep the item's "name" clean (just the dish name) and instead list each modifier as its own string in that item's "modifiers" array, in the order printed. If a modifier has its own price, add it into the parent item's "price" (it's still one line item's total) but keep the modifier text itself out of "name". Empty or omitted "modifiers" array if the item has none.
  Example — this printed receipt fragment:
    1 Burger                 12.00
      with fries
      add bacon                2.00
    1 Salad                   9.00
  becomes exactly this "items" array (two items, not four):
    [{"name": "Burger", "price": 14.00, "quantity": 1, "modifiers": ["with fries", "add bacon"]}, {"name": "Salad", "price": 9.00, "quantity": 1}]
- Prices: each price belongs to the item on its own printed line. Many receipts print items with no price at all (water, free refills, an included side) — those items are $0. Never move a price from a neighboring line onto an item that has none; if you are unsure which line a price sits on, compare its vertical position to the item names closely before deciding.
- quantity: number of units for that item (e.g. 2 for "2x Burger"). Default 1 if not shown.
- price: the TOTAL price for that line, including any merged modifier price (quantity × unit price + modifiers). Read each digit carefully.
- extraCharges: any named charge on the receipt that is NOT tax and NOT tip — service charge, delivery fee, credit card surcharge, bag fee, etc. — as its own entry with its printed name and amount. Discounts/coupons also go here with isDiscount:true and a positive amount (the amount that gets subtracted). Never fold these into subtotal, tax, or items — list every one so nothing printed on the receipt goes untracked. Empty array if there are none.
- If there are multiple tax lines (e.g. state + local), sum them into one tax total.
- tip: read carefully even if handwritten or blank — 0 if truly absent, never guessed.
- subtotal: sum of all item prices after modifiers (before tax, tip, and extraCharges).
- tax: total tax amount, 0 if absent.
- total: final amount charged.
- All monetary values must be numbers not strings. Do not include $ symbols.
- The receipt may be faded, angled, or low-contrast (thermal paper) — take extra care reading digits in that case.
- Be precise — misread prices cause incorrect splits. Double-check every number, and confirm subtotal + tax + tip + extraCharges (adding charges, subtracting discounts) equals total before responding.`;

const HAIKU_MODEL = 'claude-haiku-5-5';
// Used only as a one-time retry when Haiku's read doesn't parse or its math doesn't reconcile —
// slower and more expensive, so it's the exception path, not the default.
const SONNET_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 16000; // shared with thinking — see the comment on output_config below

// A few cents of tolerance absorbs rounding on the receipt itself; the percentage tolerance
// scales that for larger totals without being so loose it misses a genuinely misread price.
function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 0.02);
}

// Cheap sanity check on the model's own arithmetic — catches misread digits that still produced
// valid JSON (e.g. one item's price is wrong but the shape is fine) so those can be retried with
// a stronger model instead of silently handing the user a bad split.
function isReceiptSane(parsed: ParsedReceipt): boolean {
  if (!parsed.items?.length) return false;
  // $0 lines are real on restaurant receipts (free water, refills, chips), so only a negative
  // price is a misread. Rejecting $0 sent nearly every scan to the slow Sonnet retry.
  if (parsed.items.some((i) => i.price < 0)) return false;
  const itemsSum = parsed.items.reduce((s, i) => s + i.price, 0);
  if (!withinTolerance(itemsSum, parsed.subtotal)) return false;
  const extraNet = (parsed.extraCharges ?? []).reduce((s, c) => s + (c.isDiscount ? -c.amount : c.amount), 0);
  if (!withinTolerance(parsed.subtotal + parsed.tax + parsed.tip + extraNet, parsed.total)) return false;
  return true;
}

export const UNREADABLE_RECEIPT = "Couldn't read this receipt. Crop closer to just the receipt, or retake the photo.";

// Shared by both the bring-your-own-key (direct to Anthropic) and shared-key (via the
// scan-receipt Edge Function proxy) paths — both return the same raw Anthropic response shape.
function normalizeReceipt(data: { content: { type: string; text: string }[] }): ParsedReceipt {
  const text = data.content.find((c) => c.type === 'text')?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  // No JSON at all means the model answered in prose — almost always "too small/blurry to read",
  // typically a whole-table photo where the receipt is a thin strip after Claude's downscale.
  if (!jsonMatch) throw new Error(UNREADABLE_RECEIPT);

  let parsed: ParsedReceipt;
  try {
    parsed = JSON.parse(jsonMatch[0]) as ParsedReceipt;
  } catch {
    throw new Error(UNREADABLE_RECEIPT);
  }

  // Normalize whatever date format the model returned to the app's standard "Jan 4, 2027" format
  if (parsed.receiptDate) {
    parsed.receiptDate = fmtDate(parsed.receiptDate) || parsed.receiptDate;
  }

  // Ensure quantity defaults
  parsed.items = (parsed.items ?? []).map((i) => ({ ...i, quantity: i.quantity ?? 1 }));
  parsed.extraCharges = parsed.extraCharges ?? [];

  if (!parsed.subtotal && parsed.items?.length) {
    parsed.subtotal = parsed.items.reduce((s, i) => s + i.price, 0);
  }
  if (!parsed.total) {
    const extraNet = parsed.extraCharges.reduce((s, c) => s + (c.isDiscount ? -c.amount : c.amount), 0);
    parsed.total = (parsed.subtotal ?? 0) + (parsed.tax ?? 0) + (parsed.tip ?? 0) + extraNet;
  }

  return parsed;
}

async function callAnthropic(base64Image: string, apiKey: string, model: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      ...(Platform.OS === 'web' ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      // Thinking stays on at medium effort: with it off (or at low), long multi-guest receipts
      // came back with standalone upcharge lines dropped, so items stopped summing to the
      // subtotal. MAX_TOKENS has to leave room for it — at 4096 the thinking could use the whole
      // budget before any JSON was written ("no JSON in response").
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
            },
            { type: 'text', text: 'Parse this receipt.' },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${response.status}`);
  }

  return (await response.json()) as { content: { type: string; text: string }[] };
}

export async function parseReceipt(
  base64Image: string,
  apiKey: string,
): Promise<ParsedReceipt> {
  const parseWithModel = async (model: string) => normalizeReceipt(await callAnthropic(base64Image, apiKey, model));

  try {
    const result = await parseWithModel(HAIKU_MODEL);
    if (isReceiptSane(result)) return result;
    // The math doesn't reconcile — likely a misread digit. One retry with a stronger model
    // before trusting it; if that retry itself fails outright, the original read is still the
    // best thing to show the user rather than a hard error.
    try {
      return await parseWithModel(SONNET_MODEL);
    } catch {
      return result;
    }
  } catch {
    // Haiku's response wasn't even parseable JSON (often a truncation on a very long receipt) —
    // retry once with Sonnet. If this also throws, let that error propagate to the caller.
    return parseWithModel(SONNET_MODEL);
  }
}

// Same result as parseReceipt, but routed through the scan-receipt Edge Function so the app
// owner's shared Anthropic key never reaches this device — only their own Supabase session
// token does, which the function uses to verify they're actually allowed to use it. The Edge
// Function performs its own Haiku→Sonnet retry server-side, so this just normalizes whatever
// final result it returns.
export async function parseReceiptViaProxy(
  base64Image: string,
  supabaseUrl: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<ParsedReceipt> {
  // Long multi-guest receipts legitimately take 20-30s (thinking is on for accuracy), so this is
  // only a backstop against a hung request — generous enough never to cut off a real read.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  signal?.addEventListener('abort', () => controller.abort());
  const response = await fetch(`${supabaseUrl}/functions/v1/scan-receipt`, {
    signal: controller.signal,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ image: base64Image }),
  }).catch((e) => {
    // A user cancel (the caller's signal) rethrows as-is so the caller can stay silent; only our
    // own timeout turns into the friendly unreadable message.
    if (signal?.aborted) throw e;
    throw controller.signal.aborted ? new Error(UNREADABLE_RECEIPT) : e;
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${response.status}`);
  }

  const data = (await response.json()) as { content: { type: string; text: string }[] };
  return normalizeReceipt(data);
}
