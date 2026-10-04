import { PROFILE_HANDLE_KEY, PROFILE_PHOTO_KEY, PROFILE_USERNAME_KEY, PROFILE_USES_SHARED_KEY, setStorageItem } from '@/app/settings';
import { supabase } from '@/lib/supabase';
import { setSyncUserId } from '@/lib/sync';
import { useSplitStore } from '@/store/useSplitStore';
import type { ExtraCharge, Group, Home, Payer, PaymentStatus, Person, ReceiptItem, SplitRecord, Trip } from '@/types';
import { errorMessage } from '@/utils/errors';

// Remote wins, no merge/conflict resolution — the local Zustand/AsyncStorage snapshot is a single
// slot shared by whichever account last used this device, not scoped per user, so it must always
// be fully replaced by the signed-in account's real data rather than trusted as a starting point.
export async function pullRemoteStateAndReplace(userId: string) {
  // trips/homes/split_records/*_payments are intentionally NOT filtered by user_id here — RLS
  // already returns the union of rows this account owns plus rows it has joined via a share code
  // (see is_trip_member/is_home_member in supabase/migrations/0004_join_codes_and_sharing.sql),
  // and re-adding a client-side owner filter would silently hide joined trips/homes/bills.
  const [trips, homes, groups, friends, history, tripPayments, homePayments, profileRes] = await Promise.all([
    supabase.from('trips').select('*'),
    supabase.from('homes').select('*'),
    supabase.from('groups').select('*').eq('user_id', userId),
    supabase.from('friends').select('*').eq('user_id', userId),
    supabase.from('split_records').select('*'),
    supabase.from('trip_payments').select('*'),
    supabase.from('home_payments').select('*'),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);

  const mappedTrips: Trip[] = (trips.data ?? []).map((t) => ({
    id: t.id, name: t.name, emoji: t.emoji, startDate: t.start_date, endDate: t.end_date ?? undefined,
    createdAt: t.created_at, people: t.people ?? undefined, status: t.status ?? undefined,
    currency: t.currency ?? undefined, currencies: t.currencies ?? undefined,
    budget: t.budget ?? undefined, groupBudget: t.group_budget ?? undefined,
    joinCode: t.join_code ?? undefined,
  }));
  const mappedHomes: Home[] = (homes.data ?? []).map((h) => ({
    id: h.id, name: h.name, emoji: h.emoji, members: h.members ?? [], createdAt: h.created_at,
    endDate: h.end_date ?? undefined, currency: h.currency ?? undefined, status: h.status ?? undefined,
    joinCode: h.join_code ?? undefined,
  }));
  const mappedGroups: Group[] = (groups.data ?? []).map((g) => ({
    id: g.id, name: g.name, icon: g.icon, members: g.members ?? [],
  }));
  const mappedFriends: Person[] = (friends.data ?? []).map((f) => ({ id: f.id, name: f.name }));
  const mappedHistory: SplitRecord[] = (history.data ?? []).map((r) => ({
    id: r.id, date: r.date, restaurantName: r.restaurant_name ?? undefined, receiptDate: r.receipt_date ?? undefined,
    total: r.total, people: r.people ?? [], itemCount: r.item_count,
    items: (r.items ?? undefined) as ReceiptItem[] | undefined,
    fullPeople: (r.full_people ?? undefined) as Person[] | undefined,
    extraCharges: (r.extra_charges ?? undefined) as ExtraCharge[] | undefined,
    tax: r.tax ?? undefined, tip: r.tip ?? undefined, imageUri: r.image_uri ?? undefined,
    paidById: r.paid_by_id ?? undefined, paidByName: r.paid_by_name ?? undefined,
    tripId: r.trip_id ?? undefined, homeId: r.home_id ?? undefined,
    personAmounts: (r.person_amounts ?? undefined) as { name: string; amount: number }[] | undefined,
    expenseCategory: r.expense_category ?? undefined, status: r.status ?? undefined, currency: r.currency ?? undefined,
    payers: (r.payers ?? undefined) as Payer[] | undefined,
    paymentStatuses: (r.payment_statuses ?? undefined) as PaymentStatus[] | undefined,
    source: (r.source ?? undefined) as 'manual' | 'scan' | undefined,
    joinCode: r.join_code ?? undefined,
  }));
  const mappedTripPayments = (tripPayments.data ?? []).map((p) => ({
    id: p.id, tripId: p.trip_id, from: p.from_name, to: p.to_name, amount: p.amount, date: p.date,
  }));
  const mappedHomePayments = (homePayments.data ?? []).map((p) => ({
    id: p.id, homeId: p.home_id, from: p.from_name, to: p.to_name, amount: p.amount, date: p.date,
  }));

  useSplitStore.setState({
    trips: mappedTrips, homes: mappedHomes, groups: mappedGroups, friends: mappedFriends,
    history: mappedHistory, tripPayments: mappedTripPayments, homePayments: mappedHomePayments,
    ...(profileRes.data && {
      defaultCurrency: profileRes.data.default_currency ?? 'USD',
      expenseCategories: profileRes.data.expense_categories ?? useSplitStore.getState().expenseCategories,
      homeExpenseCategories: profileRes.data.home_expense_categories ?? useSplitStore.getState().homeExpenseCategories,
      itemCategories: profileRes.data.item_categories ?? useSplitStore.getState().itemCategories,
    }),
  });

  if (profileRes.data?.display_name) await setStorageItem(PROFILE_USERNAME_KEY, profileRes.data.display_name);
  if (profileRes.data?.username) await setStorageItem(PROFILE_HANDLE_KEY, profileRes.data.username);
  if (profileRes.data?.photo_url) await setStorageItem(PROFILE_PHOTO_KEY, profileRes.data.photo_url);
  await setStorageItem(PROFILE_USES_SHARED_KEY, profileRes.data?.uses_shared_key ? '1' : '0');
}

// Call once from the root layout. Additive: guest/signed-out mode never touches the network —
// `setSyncUserId(null)` makes every syncX() call in src/lib/sync.ts a synchronous no-op.
export function bootstrapAuthSync() {
  supabase.auth.onAuthStateChange((_event, session) => {
    setSyncUserId(session?.user.id ?? null);
    if (!session) return;

    pullRemoteStateAndReplace(session.user.id)
      .catch((e) => console.warn('[authSync]', errorMessage(e, String(e))));
  });
}
