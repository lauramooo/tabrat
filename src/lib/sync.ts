import { supabase } from '@/lib/supabase';
import type { Group, Home, SplitRecord, Trip } from '@/types';
import { errorMessage } from '@/utils/errors';

// Best-effort background sync to Supabase. Local Zustand/AsyncStorage state (written by the
// store's `set()` calls) is always the source of truth for the UI — these calls fire after that,
// fail silently (logged only), and are pure no-ops with zero network activity when signed out.
// No retry queue / offline mutation log — a dropped write is picked up by the next successful
// sync of that same row, not retried individually.

export let syncUserId: string | null = null;
export function setSyncUserId(id: string | null) {
  syncUserId = id;
}

function guarded(fn: (uid: string) => PromiseLike<{ error: unknown }>) {
  if (!syncUserId) return;
  Promise.resolve(fn(syncUserId)).then(({ error }) => {
    if (error) console.warn('[sync]', errorMessage(error, String(error)));
  }).catch((e) => console.warn('[sync]', errorMessage(e, String(e))));
}

// -- Trips ------------------------------------------------------------------

export function syncUpsertTrip(trip: Trip) {
  guarded((user_id) => supabase.from('trips').upsert({
    id: trip.id, user_id, name: trip.name, emoji: trip.emoji,
    start_date: trip.startDate, end_date: trip.endDate, created_at: trip.createdAt,
    people: trip.people, status: trip.status, currency: trip.currency, currencies: trip.currencies,
    budget: trip.budget, group_budget: trip.groupBudget, join_code: trip.joinCode,
  }));
}
export function syncDeleteTrip(id: string) {
  guarded(() => supabase.from('trips').delete().eq('id', id));
}

// -- Homes --------------------------------------------------------------------

export function syncUpsertHome(home: Home) {
  guarded((user_id) => supabase.from('homes').upsert({
    id: home.id, user_id, name: home.name, emoji: home.emoji, members: home.members,
    created_at: home.createdAt, end_date: home.endDate, currency: home.currency, status: home.status,
    join_code: home.joinCode,
  }));
}
export function syncDeleteHome(id: string) {
  guarded(() => supabase.from('homes').delete().eq('id', id));
}

// -- Groups ---------------------------------------------------------------------

export function syncUpsertGroup(group: Group) {
  guarded((user_id) => supabase.from('groups').upsert({
    id: group.id, user_id, name: group.name, icon: group.icon, members: group.members,
  }));
}
export function syncDeleteGroup(id: string) {
  guarded(() => supabase.from('groups').delete().eq('id', id));
}

// -- Friends ----------------------------------------------------------------------

export function syncUpsertFriend(friend: { id: string; name: string }) {
  guarded((user_id) => supabase.from('friends').upsert({
    id: friend.id, user_id, name: friend.name,
  }));
}
export function syncDeleteFriend(id: string) {
  guarded(() => supabase.from('friends').delete().eq('id', id));
}

// -- Split records (tabs / trip expenses / home expenses — one shared shape) ------

export function syncUpsertSplitRecord(r: SplitRecord) {
  guarded((user_id) => supabase.from('split_records').upsert({
    id: r.id, user_id, date: r.date, restaurant_name: r.restaurantName, receipt_date: r.receiptDate,
    total: r.total, people: r.people, item_count: r.itemCount, items: r.items ?? null,
    full_people: r.fullPeople ?? null, extra_charges: r.extraCharges ?? null, tax: r.tax, tip: r.tip,
    image_uri: r.imageUri, paid_by_id: r.paidById, paid_by_name: r.paidByName,
    trip_id: r.tripId, home_id: r.homeId, person_amounts: r.personAmounts ?? null,
    expense_category: r.expenseCategory, status: r.status, currency: r.currency,
    payers: r.payers ?? null, payment_statuses: r.paymentStatuses ?? null, source: r.source,
    join_code: r.joinCode,
  }));
}
export function syncDeleteSplitRecord(id: string) {
  guarded(() => supabase.from('split_records').delete().eq('id', id));
}

// -- Trip / home payments ("mark as paid" settle-up entries) ----------------------

export function syncUpsertTripPayment(p: { id: string; tripId: string; from: string; to: string; amount: number; date: string }) {
  guarded((user_id) => supabase.from('trip_payments').upsert({
    id: p.id, user_id, trip_id: p.tripId, from_name: p.from, to_name: p.to, amount: p.amount, date: p.date,
  }));
}
export function syncDeleteTripPaymentsFor(tripId: string, from?: string, to?: string) {
  guarded((user_id) => {
    let q = supabase.from('trip_payments').delete().eq('user_id', user_id).eq('trip_id', tripId);
    if (from !== undefined) q = q.eq('from_name', from);
    if (to !== undefined) q = q.eq('to_name', to);
    return q;
  });
}

export function syncUpsertHomePayment(p: { id: string; homeId: string; from: string; to: string; amount: number; date: string }) {
  guarded((user_id) => supabase.from('home_payments').upsert({
    id: p.id, user_id, home_id: p.homeId, from_name: p.from, to_name: p.to, amount: p.amount, date: p.date,
  }));
}
export function syncDeleteHomePaymentsFor(homeId: string, from?: string, to?: string) {
  guarded((user_id) => {
    let q = supabase.from('home_payments').delete().eq('user_id', user_id).eq('home_id', homeId);
    if (from !== undefined) q = q.eq('from_name', from);
    if (to !== undefined) q = q.eq('to_name', to);
    return q;
  });
}

// -- Profile: category lists + default currency (one row per user, not per item) --

export function syncProfileCategories(patch: Partial<{
  expenseCategories: string[]; homeExpenseCategories: string[]; itemCategories: string[]; defaultCurrency: string;
}>) {
  guarded((user_id) => supabase.from('profiles').update({
    ...(patch.expenseCategories && { expense_categories: patch.expenseCategories }),
    ...(patch.homeExpenseCategories && { home_expense_categories: patch.homeExpenseCategories }),
    ...(patch.itemCategories && { item_categories: patch.itemCategories }),
    ...(patch.defaultCurrency && { default_currency: patch.defaultCurrency }),
  }).eq('id', user_id));
}

// -- Profile: display name / photo (today raw AsyncStorage keys, not store state) --

export function syncProfileIdentity(patch: Partial<{ displayName: string; photoUrl: string | null }>) {
  guarded((user_id) => supabase.from('profiles').update({
    ...(patch.displayName !== undefined && { display_name: patch.displayName }),
    ...(patch.photoUrl !== undefined && { photo_url: patch.photoUrl }),
  }).eq('id', user_id));
}

// -- Join by code (trip/home/bill share codes) -------------------------------------

export async function joinByCode(code: string): Promise<{ kind: 'trip' | 'home' | 'bill'; itemId: string }> {
  const { data, error } = await supabase.rpc('join_by_code', { code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Invalid code');
  return { kind: row.kind, itemId: row.item_id };
}
