import { Platform } from 'react-native';
import type { ParsedReceipt } from '@/types';
import { fmtDate } from '@/utils/date';

const SYSTEM_PROMPT = `You are a receipt OCR parser. Read the receipt image carefully and extract all data.

Return ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "restaurantName": "string or null",
  "receiptDate": "string or null",
  "items": [{"name": "string", "price": number, "quantity": number}],
  "subtotal": number,
  "tax": number,
  "tip": number,
  "total": number
}

Rules:
- restaurantName: the business/restaurant name printed on the receipt. null if not visible.
- receiptDate: the date on the receipt in readable format e.g. "Jun 18, 2026". null if absent.
- items: ONLY food, drink, or retail line items. NEVER include subtotal, tax, tip, gratuity, fees, or total as items.
- quantity: number of units for that item (e.g. 2 for "2x Burger"). Default 1 if not shown.
- price: the TOTAL price for that line (quantity × unit price). Read each digit carefully.
- subtotal: sum of all item prices (before tax/tip)
- tax: tax amount, 0 if absent
- tip: tip/gratuity amount, 0 if absent
- total: final amount charged
- All monetary values must be numbers not strings. Do not include $ symbols.
- Be precise — misread prices cause incorrect splits. Double-check every number.`;

export async function parseReceipt(
  base64Image: string,
  apiKey: string,
): Promise<ParsedReceipt> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      ...(Platform.OS === 'web' ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
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

  const data = (await response.json()) as { content: { type: string; text: string }[] };
  const text = data.content.find((c) => c.type === 'text')?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse receipt — no JSON in response');

  const parsed = JSON.parse(jsonMatch[0]) as ParsedReceipt;

  // Normalize whatever date format the model returned to the app's standard "Jan 4, 2027" format
  if (parsed.receiptDate) {
    parsed.receiptDate = fmtDate(parsed.receiptDate) || parsed.receiptDate;
  }

  // Ensure quantity defaults
  parsed.items = (parsed.items ?? []).map((i) => ({ ...i, quantity: i.quantity ?? 1 }));

  if (!parsed.subtotal && parsed.items?.length) {
    parsed.subtotal = parsed.items.reduce((s, i) => s + i.price, 0);
  }
  if (!parsed.total) {
    parsed.total = (parsed.subtotal ?? 0) + (parsed.tax ?? 0) + (parsed.tip ?? 0);
  }

  return parsed;
}
