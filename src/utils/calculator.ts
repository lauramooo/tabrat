import type { Person, PersonSplit, ReceiptItem } from '@/types';
import { CURRENCIES } from '@/constants/currencies';

export function calculateSplits(
  items: ReceiptItem[],
  people: Person[],
  tax: number,
  tip: number,
  extraChargesTotal = 0,
): PersonSplit[] {
  const subtotalByPerson: Record<string, number> = {};
  people.forEach((p) => (subtotalByPerson[p.id] = 0));

  const itemSharesByPerson: Record<string, { item: ReceiptItem; share: number }[]> = {};
  people.forEach((p) => (itemSharesByPerson[p.id] = []));

  for (const item of items) {
    if (item.assignedTo.length === 0) continue;
    const share = item.price / item.assignedTo.length;
    for (const personId of item.assignedTo) {
      if (!(personId in subtotalByPerson)) continue;
      subtotalByPerson[personId] += share;
      itemSharesByPerson[personId].push({ item, share });
    }
  }

  const grandSubtotal = Object.values(subtotalByPerson).reduce((s, v) => s + v, 0);

  return people.map((person) => {
    const personSubtotal = subtotalByPerson[person.id];
    const ratio = grandSubtotal > 0 ? personSubtotal / grandSubtotal : 0;
    const taxShare = tax * ratio;
    const tipShare = tip * ratio;
    const extraShare = extraChargesTotal * ratio;
    return {
      person,
      itemShares: itemSharesByPerson[person.id],
      subtotal: personSubtotal,
      taxShare,
      tipShare,
      extraShare,
      total: personSubtotal + taxShare + tipShare + extraShare,
    };
  });
}

// Derived from the shared currency list (src/constants/currencies.ts) rather than a separate
// hardcoded map — previously this had its own drifted-out-of-sync copy of symbols that was
// missing most of the currencies selectable elsewhere in the app, so picking one of those showed
// its raw ISO code (e.g. "ARS37.62") instead of a symbol everywhere money gets formatted.
const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol]),
);

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

export const fmt = (n: number, currency = 'USD') =>
  `${getCurrencySymbol(currency)}${n.toFixed(2)}`;

/** Strips a typed value down to digits, '.', and ',' — for number-only fields (amounts, qty, %). */
export const sanitizeNumberInput = (text: string) => text.replace(/[^0-9.,]/g, '');

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function calculateTripSettlement(
  tabs: Array<{ personAmounts?: Array<{ name: string; amount: number }>; paidByName?: string }>,
): Settlement[] {
  // net[name] > 0 → owes money; < 0 → is owed money
  const net: Record<string, number> = {};

  for (const tab of tabs) {
    if (!tab.paidByName || !tab.personAmounts) continue;
    const payer = tab.paidByName;
    for (const { name, amount } of tab.personAmounts) {
      if (name === payer) continue;
      net[name] = (net[name] ?? 0) + amount;
      net[payer] = (net[payer] ?? 0) - amount;
    }
  }

  const debtors = Object.entries(net)
    .filter(([, v]) => v > 0.005)
    .map(([name, amt]) => ({ name, amt }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = Object.entries(net)
    .filter(([, v]) => v < -0.005)
    .map(([name, amt]) => ({ name, amt: -amt }))
    .sort((a, b) => b.amt - a.amt);

  const results: Settlement[] = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const amt = Math.min(d.amt, c.amt);
    if (amt > 0.005) results.push({ from: d.name, to: c.name, amount: amt });
    d.amt -= amt;
    c.amt -= amt;
    if (d.amt < 0.005) di++;
    if (c.amt < 0.005) ci++;
  }
  return results;
}
