import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useMyName(): string {
  const [myName, setMyName] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const v = Platform.OS === 'web'
          ? localStorage.getItem('profile_username')
          : await AsyncStorage.getItem('profile_username');
        if (v) setMyName(v);
      } catch {}
    })();
  }, []);
  return myName;
}

/** The current device user's own profile photo URI, if they've set one — read from the same
 * storage key settings.tsx/me.tsx write to. Lets any avatar recognize "this is me" and show
 * the real photo instead of a colored initials circle, without every call site wiring it up. */
export function useMyPhoto(): string | null {
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const v = Platform.OS === 'web'
          ? localStorage.getItem('profile_photo')
          : await AsyncStorage.getItem('profile_photo');
        if (v) setMyPhoto(v);
      } catch {}
    })();
  }, []);
  return myPhoto;
}

// me first, then alphabetical. works for string[] and { name: string }[]
export function sortWithMeFirst(items: string[], myName?: string | null): string[];
export function sortWithMeFirst<T extends { name: string }>(items: T[], myName?: string | null): T[];
export function sortWithMeFirst(items: any[], myName?: string | null): any[] {
  const lo = myName?.toLowerCase();
  return [...items].sort((a, b) => {
    const an: string = typeof a === 'string' ? a : a.name;
    const bn: string = typeof b === 'string' ? b : b.name;
    if (lo && an.toLowerCase() === lo) return -1;
    if (lo && bn.toLowerCase() === lo) return 1;
    return an.localeCompare(bn);
  });
}
