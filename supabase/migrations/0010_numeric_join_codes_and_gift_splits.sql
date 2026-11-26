-- 1. Gift splits on trip expenses: participants being treated (owe $0) and who splits their shares.
alter table public.split_records add column if not exists covered_people text[];
alter table public.split_records add column if not exists covered_by text[];

-- 2. Share codes become 6 digits so the join box can use the number keypad.

-- A 6-digit code not used by any trip, home or bill (other than the row it's for). Codes must be
-- unique across all three tables since join_by_code looks them up in each. Security definer so
-- the check sees everyone's codes, not just the rows the signed-in user can read.
create or replace function public.join_code_taken(c text, self_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where join_code = c and id <> self_id)
      or exists (select 1 from public.homes where join_code = c and id <> self_id)
      or exists (select 1 from public.split_records where join_code = c and id <> self_id);
$$;

create or replace function public.new_numeric_join_code(self_id text)
returns text language plpgsql as $$
declare c text;
begin
  loop
    c := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not public.join_code_taken(c, self_id);
  end loop;
  return c;
end;
$$;

-- Every write goes through this: an app version from before this change still sends its old
-- letter code with each save — keep the row's numeric code instead of reverting it. Any other
-- non-numeric or already-taken code (e.g. a rare collision of two phone-generated codes) gets a
-- fresh one; the app picks it up on its next pull.
create or replace function public.normalize_join_code()
returns trigger language plpgsql as $$
begin
  if new.join_code is null then return new; end if;
  if tg_op = 'UPDATE' and old.join_code ~ '^[0-9]{6}$' and new.join_code !~ '^[0-9]{6}$' then
    new.join_code := old.join_code;
  elsif new.join_code !~ '^[0-9]{6}$' or public.join_code_taken(new.join_code, new.id::text) then
    new.join_code := public.new_numeric_join_code(new.id::text);
  end if;
  return new;
end;
$$;

create trigger trips_normalize_join_code before insert or update on public.trips
  for each row execute function public.normalize_join_code();
create trigger homes_normalize_join_code before insert or update on public.homes
  for each row execute function public.normalize_join_code();
create trigger split_records_normalize_join_code before insert or update on public.split_records
  for each row execute function public.normalize_join_code();

-- Switch existing letter codes over (the trigger above assigns the new numeric code).
update public.trips set join_code = join_code where join_code is not null and join_code !~ '^[0-9]{6}$';
update public.homes set join_code = join_code where join_code is not null and join_code !~ '^[0-9]{6}$';
update public.split_records set join_code = join_code where join_code is not null and join_code !~ '^[0-9]{6}$';
