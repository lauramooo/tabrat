-- Fix: creating a trip or home was failing RLS on INSERT ... RETURNING (which supabase-js's
-- .upsert() issues by default). The SELECT policy that RETURNING must also satisfy went straight
-- through is_trip_member()/is_home_member() — SECURITY DEFINER functions that re-query the same
-- table they're protecting. SECURITY DEFINER blocks query inlining, so that nested lookup doesn't
-- reliably see the row this same command just inserted, and the check fails even for the row's own
-- owner. split_records/trip_payments/home_payments never hit this because their policies check
-- auth.uid() = user_id directly first — same fix here: short-circuit on direct ownership before
-- ever calling the self-referential helper.

drop policy "select own or member" on public.trips;
create policy "select own or member" on public.trips for select
  using (auth.uid() = user_id or public.is_trip_member(id, auth.uid()));

drop policy "update own or member" on public.trips;
create policy "update own or member" on public.trips for update
  using (auth.uid() = user_id or public.is_trip_member(id, auth.uid()))
  with check (auth.uid() = user_id or public.is_trip_member(id, auth.uid()));

drop policy "select own or member" on public.homes;
create policy "select own or member" on public.homes for select
  using (auth.uid() = user_id or public.is_home_member(id, auth.uid()));

drop policy "update own or member" on public.homes;
create policy "update own or member" on public.homes for update
  using (auth.uid() = user_id or public.is_home_member(id, auth.uid()))
  with check (auth.uid() = user_id or public.is_home_member(id, auth.uid()));
