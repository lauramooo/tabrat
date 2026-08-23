import { AVATAR_PALETTE } from '@/constants/colors';
import type { SplitRecord } from '@/types';

// Fixed neutral color for the "Other"/uncategorized bucket — kept out of the rotating
// AVATAR_PALETTE so it reads as "no category" rather than competing with real categories,
// and shared by both the trip dashboard's donut slice and the expense-card category chip.
export const UNCATEGORIZED_COLOR = { bg: '#DCD3C7', text: '#6E6459' };

export interface CategoryDatum {
  label: string;
  value: number;
  color: string;
  textColor: string;
}

/**
 * Buckets a trip's expenses by category (respecting an optional scoped person's own share),
 * assigning each real category a color from AVATAR_PALETTE and "Other" the fixed neutral
 * color above — used by both the dashboard donut/legend and the expense list's category chips
 * so the two always agree on what color a category is.
 */
export function getCategoryData(tabs: SplitRecord[], scopePerson: string): { catData: CategoryDatum[]; catTotal: number } {
  const cats: Record<string, number> = {};
  let total = 0;
  for (const tab of tabs) {
    const cat = tab.expenseCategory ?? 'Other';
    if (scopePerson) {
      const pa = tab.personAmounts?.find((p) => p.name === scopePerson);
      const share = pa?.amount ?? 0;
      if (share > 0) { cats[cat] = (cats[cat] ?? 0) + share; total += share; }
    } else {
      cats[cat] = (cats[cat] ?? 0) + tab.total; total += tab.total;
    }
  }
  let paletteIdx = 0;
  const catData = Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => {
      if (label === 'Other') return { label, value, color: UNCATEGORIZED_COLOR.bg, textColor: UNCATEGORIZED_COLOR.text };
      const c = AVATAR_PALETTE[paletteIdx % AVATAR_PALETTE.length];
      paletteIdx += 1;
      return { label, value, color: c.bg, textColor: c.text };
    });
  return { catData, catTotal: total };
}

export function getCategoryColorMap(catData: CategoryDatum[]): Map<string, { bg: string; text: string }> {
  return new Map(catData.map((c) => [c.label, { bg: c.color, text: c.textColor }]));
}
