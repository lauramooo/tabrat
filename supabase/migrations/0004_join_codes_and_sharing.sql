-- Join codes + shared collaborator access for trips, homes, and standalone bills.
-- Codes are generated client-side (same convention as this app's other ids) and just stored
-- here; this migration is about who gets access once someone redeems one.
--
-- Model: joining grants full collaborator access (read/write) to the shared trip/home/bill and
-- everything under it (expenses, settle-up payments) — not just a read-only view. The original
-- owner (trips.user_id / homes.user_id / split_records.user_id) is never itself a row in the
-- *_members tables; ownership and membership are checked together via the is_*_member() helpers.

alter table public.trips add column join_code text;
alter table public.homes add column join_code text;
alter table public.split_records add column join_code text;

create unique index trips_join_code_idx on public.trips (join_code);
create unique index homes_join_code_idx on public.homes (join_code);
create unique index split_records_join_code_idx on public.split_records (join_code);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table public.home_members (
  id uuid primary key default gen_random_uuid(),
  home_id text not null references public.homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (home_id, user_id)
);

create table public.bill_members (
  id uuid primary key default gen_random_uuid(),
  bill_id text not null references public.split_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (bill_id, user_id)
);

create index on public.trip_members (user_id);
create index on public.home_members (user_id);
create index on public.bill_members (user_id);

alter table public.trip_members enable row level security;
alter table public.home_members enable row level security;
alter table public.bill_members enable row level security;

-- Membership rows themselves are only ever written by join_by_code() (security definer, below) —
-- these policies just let a member see their own membership and let an owner see who's joined.
create policy "view own or owned" on public.trip_members for select
  using (user_id = auth.uid() or exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));
create policy "leave or remove" on public.trip_members for delete
  using (user_id = auth.uid() or exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid()));

create policy "view own or owned" on public.home_members for select
  using (user_id = auth.uid() or exists (select 1 from public.homes h where h.id = home_id and h.user_id = auth.uid()));
create policy "leave or remove" on public.home_members for delete
  using (user_id = auth.uid() or exists (select 1 from public.homes h where h.id = home_id and h.user_id = auth.uid()));

create policy "view own or owned" on public.bill_members for select
  using (user_id = auth.uid() or exists (select 1 from public.split_records b where b.id = bill_id and b.user_id = auth.uid()));
create policy "leave or remove" on public.bill_members for delete
  using (user_id = auth.uid() or exists (select 1 from public.split_records b where b.id = bill_id and b.user_id = auth.uid()));

-- Helper predicates: true if p_user_id owns the parent row or has joined it. security definer so
-- they can be used inside another table's RLS policy without that policy's own visibility rules
-- getting in the way (and so they read *_members without needing a policy that exposes it further).
create function public.is_trip_member(p_trip_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and (t.user_id = p_user_id or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = p_user_id))
  );
$$;

create function public.is_home_member(p_home_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.homes h
    where h.id = p_home_id
      and (h.user_id = p_user_id or exists (select 1 from public.home_members m where m.home_id = h.id and m.user_id = p_user_id))
  );
$$;

create function public.is_bill_member(p_bill_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.split_records b
    where b.id = p_bill_id
      and (b.user_id = p_user_id or exists (select 1 from public.bill_members m where m.bill_id = b.id and m.user_id = p_user_id))
  );
$$;

-- A collaborator upserting a shared row must never be able to reassign it to themselves — pin
-- user_id to whatever it already was, regardless of what the update payload sends.
create function public.prevent_owner_change()
returns trigger language plpgsql as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;

create trigger trips_lock_owner before update on public.trips for each row execute function public.prevent_owner_change();
create trigger homes_lock_owner before update on public.homes for each row execute function public.prevent_owner_change();
create trigger split_records_lock_owner before update on public.split_records for each row execute function public.prevent_owner_change();

-- Redeem a code: security definer so a non-member can resolve a code to a row (which a normal
-- select policy can't safely allow — that would let anyone enumerate/read others' trips) and
-- atomically record membership. Returns which kind of thing was joined and its id, so the client
-- can navigate straight to it and re-pull. Joining your own code is a harmless no-op read.
create function public.join_by_code(code text)
returns table(kind text, item_id text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text := upper(trim(code));
  found_id text;
  owner_id uuid;
begin
  select id, user_id into found_id, owner_id from public.trips where join_code = v_code;
  if found_id is not null then
    if owner_id <> auth.uid() then
      insert into public.trip_members (trip_id, user_id) values (found_id, auth.uid()) on conflict do nothing;
    end if;
    return query select 'trip'::text, found_id;
    return;
  end if;

  select id, user_id into found_id, owner_id from public.homes where join_code = v_code;
  if found_id is not null then
    if owner_id <> auth.uid() then
      insert into public.home_members (home_id, user_id) values (found_id, auth.uid()) on conflict do nothing;
    end if;
    return query select 'home'::text, found_id;
    return;
  end if;

  select id, user_id into found_id, owner_id from public.split_records where join_code = v_code;
  if found_id is not null then
    if owner_id <> auth.uid() then
      insert into public.bill_members (bill_id, user_id) values (found_id, auth.uid()) on conflict do nothing;
    end if;
    return query select 'bill'::text, found_id;
    return;
  end if;

  raise exception 'Invalid code';
end;
$$;

grant execute on function public.join_by_code(text) to authenticated;

-- Rewritten RLS: owner-or-member can read/write; only the owner can delete a trip/home outright
-- (deleting one expense within it is a normal collaborative action and stays member-writable).

drop policy "own rows" on public.trips;
create policy "select own or member" on public.trips for select using (public.is_trip_member(id, auth.uid()));
create policy "insert own" on public.trips for insert with check (auth.uid() = user_id);
create policy "update own or member" on public.trips for update
  using (public.is_trip_member(id, auth.uid())) with check (public.is_trip_member(id, auth.uid()));
create policy "delete own" on public.trips for delete using (auth.uid() = user_id);

drop policy "own rows" on public.homes;
create policy "select own or member" on public.homes for select using (public.is_home_member(id, auth.uid()));
create policy "insert own" on public.homes for insert with check (auth.uid() = user_id);
create policy "update own or member" on public.homes for update
  using (public.is_home_member(id, auth.uid())) with check (public.is_home_member(id, auth.uid()));
create policy "delete own" on public.homes for delete using (auth.uid() = user_id);

drop policy "own rows" on public.split_records;
create policy "select own or member" on public.split_records for select
  using (
    auth.uid() = user_id
    or (trip_id is not null and public.is_trip_member(trip_id, auth.uid()))
    or (home_id is not null and public.is_home_member(home_id, auth.uid()))
    or public.is_bill_member(id, auth.uid())
  );
create policy "insert own or member" on public.split_records for insert
  with check (
    auth.uid() = user_id
    and (
      (trip_id is null and home_id is null)
      or (trip_id is not null and public.is_trip_member(trip_id, auth.uid()))
      or (home_id is not null and public.is_home_member(home_id, auth.uid()))
    )
  );
create policy "update own or member" on public.split_records for update
  using (
    auth.uid() = user_id
    or (trip_id is not null and public.is_trip_member(trip_id, auth.uid()))
    or (home_id is not null and public.is_home_member(home_id, auth.uid()))
    or public.is_bill_member(id, auth.uid())
  )
  with check (
    auth.uid() = user_id
    or (trip_id is not null and public.is_trip_member(trip_id, auth.uid()))
    or (home_id is not null and public.is_home_member(home_id, auth.uid()))
    or public.is_bill_member(id, auth.uid())
  );
create policy "delete own or member" on public.split_records for delete
  using (
    auth.uid() = user_id
    or (trip_id is not null and public.is_trip_member(trip_id, auth.uid()))
    or (home_id is not null and public.is_home_member(home_id, auth.uid()))
    or public.is_bill_member(id, auth.uid())
  );

drop policy "own rows" on public.trip_payments;
create policy "select own or member" on public.trip_payments for select using (public.is_trip_member(trip_id, auth.uid()));
create policy "insert own or member" on public.trip_payments for insert
  with check (auth.uid() = user_id and public.is_trip_member(trip_id, auth.uid()));
create policy "update own or member" on public.trip_payments for update
  using (public.is_trip_member(trip_id, auth.uid())) with check (public.is_trip_member(trip_id, auth.uid()));
create policy "delete own or member" on public.trip_payments for delete using (public.is_trip_member(trip_id, auth.uid()));

drop policy "own rows" on public.home_payments;
create policy "select own or member" on public.home_payments for select using (public.is_home_member(home_id, auth.uid()));
create policy "insert own or member" on public.home_payments for insert
  with check (auth.uid() = user_id and public.is_home_member(home_id, auth.uid()));
create policy "update own or member" on public.home_payments for update
  using (public.is_home_member(home_id, auth.uid())) with check (public.is_home_member(home_id, auth.uid()));
create policy "delete own or member" on public.home_payments for delete using (public.is_home_member(home_id, auth.uid()));
