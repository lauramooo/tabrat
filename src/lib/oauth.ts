import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

// Required once per app load so the in-app browser tab closes itself and hands control back to
// the app after the OAuth provider redirects — see expo-web-browser docs on the web/cancel case.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

// Supabase's hosted OAuth flow: open the provider's consent screen in an in-app browser tab, then
// exchange the PKCE code it redirects back with for a real session. Identical for every provider —
// the app doesn't need a provider-specific native SDK. Each provider still has to be enabled with
// real credentials in the Supabase dashboard (Authentication > Providers) before its button works;
// until then this throws whatever error Supabase returns for a disabled provider.
export async function signInWithOAuth(provider: OAuthProvider) {
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No sign-in URL returned.');

  // signInWithOAuth resolves almost instantly — the authorize URL is built from local PKCE values,
  // no network round-trip — so without this, a caller's "in progress" UI state (e.g. a button fill)
  // set right before calling this function can lose the race against the browser sheet opening and
  // never actually get painted. Two rAFs guarantee at least one full render+paint cycle first.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return; // user backed out — not an error
  if (result.type !== 'success' || !result.url) throw new Error('Sign-in was interrupted.');

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code !== 'string') {
    const description = queryParams?.error_description;
    throw new Error(typeof description === 'string' ? description : 'Sign-in did not complete.');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
