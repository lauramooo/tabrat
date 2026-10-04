// Deletes the calling user's Supabase Auth identity (and, via `on delete cascade`, every row
// they own across trips/homes/groups/friends/split_records/trip_payments/home_payments/profiles).
// Runs with the service_role key, which must never ship in the client — this is why the delete
// has to go through a server-side function instead of the app calling Postgres directly.
//
// Deploy: supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Browsers send a CORS preflight (OPTIONS) before the real request for any cross-origin fetch
// with custom headers like Authorization — without these, that preflight gets no
// Access-Control-Allow-Origin header and the browser blocks the real request before it's ever
// sent, silently falling through to this app's client-side fallback path on every web call.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the caller from their own JWT (validated against Supabase, not trusted from the
  // request body) before doing anything destructive.
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const admin = createClient(url, serviceRoleKey);
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
});
