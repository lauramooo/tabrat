import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check your .env file.');
}

// Expo Router's web build server-renders on Node before the browser loads it. Supabase reads
// from storage immediately on client creation, and AsyncStorage's web implementation touches
// `window` — which doesn't exist during that SSR pass. No-op there instead of crashing; the real
// browser session loads normally once this module re-runs client-side after hydration.
//
// On native, the session (access + refresh tokens) goes through expo-secure-store — the OS
// Keychain/Keystore — rather than AsyncStorage's plain unencrypted storage, since a leaked
// refresh token is a full account takeover. Web has no Keychain equivalent, so it stays on
// AsyncStorage there (same as before).
const ssrSafeStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: ssrSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE returns a `code` param to exchange server-side (src/lib/oauth.ts), instead of the
    // implicit flow's default of putting tokens directly in the redirect URL fragment — more
    // reliable across the different in-app browser tabs OAuth sign-in bounces through.
    flowType: 'pkce',
  },
});
