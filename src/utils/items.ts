import type { ReceiptItem } from '@/types';

export const extrasTotal = (item: ReceiptItem) => (item.extras ?? []).reduce((s, e) => s + e.price, 0);

// The grey details line shown under an item everywhere it's listed: the receipt's own
// modifiers, then anything the user added to it.
export function itemDetailLabels(item: ReceiptItem): string[] {
  return [
    ...(item.modifiers ?? []),
    ...(item.extras ?? []).map((e) => (e.quantity > 1 ? `${e.quantity}× ${e.name}` : e.name)),
  ];
}
