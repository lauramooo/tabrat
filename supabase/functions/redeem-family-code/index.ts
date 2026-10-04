// Grants the calling user access to the app owner's shared Anthropic key by setting their
// profiles.uses_shared_key flag — the ONLY place that flag is allowed to be set (the DB trigger
// profiles_lock_shared_key rejects any other attempt to change it). The invite code itself is a
// server secret (FAMILY_INVITE_CODE), never shipped to the client, so it can't be read out of the
// app bundle the way a client-side check could be.
//
// Deploy: supabase functions deploy redeem-family-code
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Browsers send a CORS preflight (OPTIONS) before the real request for any cross-origin fetch
// with custom headers like Authorization — without these, that preflight gets no
// Access-Control-Allow-Origin header and the browser blocks the real request before it's ever
// sent. curl doesn't enforce CORS, which is why this can pass a curl test and still fail from a
// real browser.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...corsHeaders } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  const code = (body.code ?? '').trim();
  const expected = Deno.env.get('FAMILY_INVITE_CODE');
  if (!expected || code.toLowerCase() !== expected.toLowerCase()) {
    return json({ error: 'Invalid code' }, 403);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the caller from their own JWT (validated against Supabase, not trusted from the
  // request body) before granting anything.
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(url, serviceRoleKey);
  const { error } = await admin.from('profiles').update({ uses_shared_key: true }).eq('id', user.id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true }, 200);
});
