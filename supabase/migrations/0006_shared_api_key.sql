-- Lets the app owner share their own Anthropic key with invited friends/family for receipt
-- scanning, without ever exposing the raw key to them. `uses_shared_key` gates both the client
-- UI (Settings hides the "bring your own key" field) and the scan-receipt Edge Function (which
-- holds the real key as a server secret and refuses to use it for anyone without this flag).
--
-- Critically, this column must never be settable by a normal client update — otherwise anyone
-- could just flip it on themselves and get free access. Only the redeem-family-code Edge
-- Function (using the service-role key, which carries auth.role() = 'service_role') is allowed
-- to change it; a client-side update attempt is silently reverted back to its prior value.

alter table public.profiles add column uses_shared_key boolean not null default false;

create function public.prevent_shared_key_self_grant()
returns trigger language plpgsql as $$
begin
  if new.uses_shared_key is distinct from old.uses_shared_key and auth.role() <> 'service_role' then
    new.uses_shared_key := old.uses_shared_key;
  end if;
  return new;
end;
$$;

create trigger profiles_lock_shared_key before update on public.profiles
  for each row execute function public.prevent_shared_key_self_grant();
