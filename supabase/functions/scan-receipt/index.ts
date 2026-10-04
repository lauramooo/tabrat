// Proxies a receipt-scan request to Anthropic using the app owner's own key (ANTHROPIC_API_KEY,
// a server secret never shipped to the client) — only for callers whose profiles.uses_shared_key
// flag is set. Returns the raw Anthropic response; the client does the same JSON-extraction and
// normalization it already does for the bring-your-own-key path (see src/utils/receiptParser.ts).
//
// Keep the prompt/model/retry logic below in sync with src/utils/receiptParser.ts — this function
// runs in Deno and can't import from there, so it's intentionally duplicated. If you change one,
// change the other.
//
// Deploy: supabase functions deploy scan-receipt
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096; // was 1024 — truncated mid-JSON on longer receipts (20-30+ items)

type ParsedReceiptLike = {
  items?: { price: number }[];
  subtotal?: number;
  tax?: number;
  tip?: number;
  extraCharges?: { amount: number; isDiscount?: boolean }[];
  total?: number;
};

function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 0.02);
}

function isReceiptSane(parsed: ParsedReceiptLike): boolean {
  if (!parsed.items?.length) return false;
  // A real menu item is essentially never $0 — the tell-tale sign of an unmerged
  // modifier/sub-line that leaked through as its own item — so treat it as worth a retry.
  if (parsed.items.some((i) => i.price <= 0)) return false;
  const itemsSum = parsed.items.reduce((s, i) => s + i.price, 0);
  if (!withinTolerance(itemsSum, parsed.subtotal ?? 0)) return false;
  const extraNet = (parsed.extraCharges ?? []).reduce((s, c) => s + (c.isDiscount ? -c.amount : c.amount), 0);
  if (!withinTolerance((parsed.subtotal ?? 0) + (parsed.tax ?? 0) + (parsed.tip ?? 0) + extraNet, parsed.total ?? 0)) return false;
  return true;
}

// Best-effort extraction just for the server-side sanity check — the client re-does this
// properly (with date normalization etc.) on whichever raw response this function returns.
function tryExtractReceipt(data: { content?: { type: string; text: string }[] }): ParsedReceiptLike | null {
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as ParsedReceiptLike;
  } catch {
    return null;
  }
}

// Browsers send a CORS preflight (OPTIONS) before the real request for any cross-origin fetch
// with custom headers like Authorization — without these, that preflight gets no
// Access-Control-Allow-Origin header and the browser blocks the real request before it's ever
// sent. curl doesn't enforce CORS, which is why this can pass a curl test and still fail from a
// real browser.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...corsHeaders } });
}

async function callAnthropic(anthropicKey: string, base64Image: string, model: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
            { type: 'text', text: 'Parse this receipt.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message ?? `Anthropic API error ${res.status}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  const base64Image = body.image;
  if (!base64Image) return json({ error: 'Missing image' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  // Defense in depth — don't trust a client-side flag, re-check the real row before spending
  // the owner's key on this request.
  const { data: profile, error: profileError } = await callerClient
    .from('profiles').select('uses_shared_key').eq('id', user.id).maybeSingle();
  if (profileError || !profile?.uses_shared_key) {
    return json({ error: 'Not authorized to use the shared key' }, 403);
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'Server is not configured with a shared key' }, 500);

  try {
    const first = await callAnthropic(anthropicKey, base64Image, HAIKU_MODEL);
    const firstParsed = tryExtractReceipt(first);

    if (firstParsed && isReceiptSane(firstParsed)) return json(first, 200);

    // Either unparseable JSON (often a truncation on a very long receipt) or the numbers didn't
    // reconcile (likely a misread digit) — one retry with a stronger model before trusting it.
    // If the retry itself throws, fall back to the original response rather than a hard error.
    try {
      const retry = await callAnthropic(anthropicKey, base64Image, SONNET_MODEL);
      return json(retry, 200);
    } catch {
      return json(first, 200);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 502);
  }
});
