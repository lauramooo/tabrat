import { useEffect, useState } from 'react';
import { getStorageItem, setStorageItem } from '@/app/settings';

const CACHE_KEY_PREFIX = 'exchange_rates_';
// Rates update roughly daily — no point refetching more often than that.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

async function readCache(base: string): Promise<RatesCache | null> {
  const raw = await getStorageItem(CACHE_KEY_PREFIX + base);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RatesCache;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Fetches (or reuses a same-day cached copy of) exchange rates relative to `base` — rates[X] is
// how many units of X equal 1 unit of base. No API key needed. Returns null on failure with no
// usable cache so callers can fall back to showing unconverted totals rather than breaking.
export async function getExchangeRates(base: string): Promise<Record<string, number> | null> {
  const cached = await readCache(base);
  if (cached) return cached.rates;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`);
    const data = await res.json();
    if (data.result !== 'success' || !data.rates) throw new Error('Unexpected rate response');
    await setStorageItem(CACHE_KEY_PREFIX + base, JSON.stringify({ base, rates: data.rates, fetchedAt: Date.now() }));
    return data.rates as Record<string, number>;
  } catch {
    return null;
  }
}

// Converts an amount from `from` into `base`, using rates fetched with that same base.
// rates[from] = units of `from` per 1 unit of base, so amount-in-base = amount-in-from / rates[from].
export function convertToBase(amount: number, from: string, base: string, rates: Record<string, number> | null): number {
  if (!rates || from === base) return amount;
  const rate = rates[from];
  if (!rate) return amount; // unknown currency code — best effort, don't corrupt the total
  return amount / rate;
}

// `enabled` lets a caller skip the fetch entirely for a single-currency trip/home, which is the
// common case — no need to hit the network when there's nothing to convert.
export function useExchangeRates(base: string, enabled: boolean): Record<string, number> | null {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!enabled) { setRates(null); return; }
    let cancelled = false;
    getExchangeRates(base).then((r) => { if (!cancelled) setRates(r); });
    return () => { cancelled = true; };
  }, [base, enabled]);
  return rates;
}
