-- A distinct, unique handle separate from display_name (which is just a friendly label and can
-- collide between users) — this is what the future "add friends" feature will look people up by.
-- Nullable at the DB level since existing rows predate this column; the onboarding flow is what
-- actually enforces "required" before a user reaches the rest of the app.

alter table public.profiles add column username text;

alter table public.profiles add constraint username_format
  check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$');

create unique index profiles_username_unique_idx on public.profiles (lower(username));

-- RLS on profiles only lets you read your own row, so the client has no way to check whether a
-- username is already taken by someone else. This runs with elevated privileges to answer just
-- that one yes/no question without exposing any other row's data.
create function public.is_username_available(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(check_username)
  );
$$;

grant execute on function public.is_username_available(text) to authenticated;
