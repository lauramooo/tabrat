// Raw messages that come straight from the native network layer (DNS failures, offline device,
// timeouts) rather than from our own API/Supabase — these read as engineering internals to a user
// ("A server with the specified hostname could not be found"), so they're translated below instead
// of being shown as-is.
const NETWORK_FAILURE_PATTERN =
  /could not be found|network request failed|fetch failed|the internet connection appears to be offline|timed out|ENOTFOUND|ECONNREFUSED/i;

// Native exceptions (especially from Expo modules on iOS) often append where in the native code
// they were thrown, e.g. "... (at ExpoModulesCore/Promise.swift:56)" — that's debug info, not
// something a user should ever see, so it's stripped from any message before display.
const NATIVE_LOCATION_SUFFIX = /\s*\(at [^)]+\)\s*$/;

// Supabase throws a real Error instance for some failures (network errors, thrown `new Error(...)`)
// but a plain {code, message, details, hint} object for others (e.g. a PostgrestError from a
// failed RPC call) — `instanceof Error` silently misses the latter and drops the real message.
// Always check for a `.message` field instead of assuming the exception is an Error instance.
export function errorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : null;

  if (raw == null) return fallback;
  if (NETWORK_FAILURE_PATTERN.test(raw)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  return raw.replace(NATIVE_LOCATION_SUFFIX, '').trim() || fallback;
}
