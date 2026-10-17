-- Testing phase (friends & family via TestFlight): every account scans receipts with the app
-- owner's shared Anthropic key — no invite code or bring-your-own-key step. The invite-code
-- machinery (redeem-family-code, the self-grant trigger from 0006) is left in place so this can be
-- reverted to opt-in once there's a paid plan: set the default back to false.
alter table public.profiles alter column uses_shared_key set default true;
update public.profiles set uses_shared_key = true where uses_shared_key = false;
