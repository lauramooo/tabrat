-- Initial schema for tab-rat: own-data-only accounts, email+password auth.
-- Primary keys stay `text` using the app's existing client-generated ids (see `uid()`
-- in src/store/useSplitStore.ts) so trip/home linkage keeps working as plain string joins.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  photo_url text,
  default_currency text default 'USD',
  expense_categories text[] default array['Hotel','Food & Drinks','Transport','Activities','Shopping','Other'],
  home_expense_categories text[] default array['Rent','Electric','Gas','Water','Internet','Groceries','Cleaning','Subscriptions','Other'],
  item_categories text[] default array['Drinks','Apps','Dessert','Mains','Other'],
  updated_at timestamptz not null default now()
);

create table public.trips (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  emoji text,
  start_date text,
  end_date text,
  created_at text not null,
  people text[],
  status text default 'open',
  currency text,
  currencies text[],
  budget numeric,
  group_budget numeric,
  updated_at timestamptz not null default now()
);

create table public.homes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  emoji text,
  members text[] not null default '{}',
  created_at text not null,
  end_date text,
  currency text,
  status text default 'open',
  updated_at timestamptz not null default now()
);

create table public.groups (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  icon text,
  members text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.friends (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  updated_at timestamptz not null default now()
);

create table public.split_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  restaurant_name text,
  receipt_date text,
  total numeric not null default 0,
  people text[] not null default '{}',
  item_count integer not null default 0,
  items jsonb,
  full_people jsonb,
  extra_charges jsonb,
  tax numeric,
  tip numeric,
  image_uri text,
  paid_by_id text,
  paid_by_name text,
  trip_id text,
  home_id text,
  person_amounts jsonb,
  expense_category text,
  status text default 'open',
  currency text,
  payers jsonb,
  payment_statuses jsonb,
  source text,
  updated_at timestamptz not null default now()
);

create table public.trip_payments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  trip_id text not null,
  from_name text not null,
  to_name text not null,
  amount numeric not null,
  date text not null
);

create table public.home_payments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  home_id text not null,
  from_name text not null,
  to_name text not null,
  amount numeric not null,
  date text not null
);

create index on public.trips (user_id);
create index on public.homes (user_id);
create index on public.groups (user_id);
create index on public.friends (user_id);
create index on public.split_records (user_id);
create index on public.split_records (trip_id);
create index on public.split_records (home_id);
create index on public.trip_payments (user_id, trip_id);
create index on public.home_payments (user_id, home_id);

-- Row Level Security: every table is scoped to auth.uid() so each account only ever
-- sees/writes its own rows.

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.homes enable row level security;
alter table public.groups enable row level security;
alter table public.friends enable row level security;
alter table public.split_records enable row level security;
alter table public.trip_payments enable row level security;
alter table public.home_payments enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own rows" on public.trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.homes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.groups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.friends for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.split_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.trip_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.home_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
