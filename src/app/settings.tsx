import * as SecureStore from 'expo-secure-store';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, ConfirmModal, IconBadge, SectionLabel } from '@/components/design';
import { AlertIcon, TrashIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { supabase } from '@/lib/supabase';
import { useSplitStore } from '@/store/useSplitStore';
import { mediumHaptic, selectionHaptic } from '@/utils/haptics';
import { Text } from '@/components/design/Text';

export const API_KEY_STORAGE_KEY = 'anthropic_api_key';
export const PROFILE_USERNAME_KEY = 'profile_username';
export const PROFILE_PHOTO_KEY = 'profile_photo';
// Distinct from PROFILE_USERNAME_KEY (which despite its name actually holds the display name) —
// this is the unique @handle set during onboarding, for the future "add friends" lookup.
export const PROFILE_HANDLE_KEY = 'profile_handle';

export { CURRENCIES } from '@/constants/currencies';

// Bring-your-own-key scanning was removed for the testing phase (everyone scans via the shared
// key — see supabase/migrations/0008). Kept only so Delete account still clears a key saved by an
// older build.
async function removeApiKey(): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(API_KEY_STORAGE_KEY); return; }
  return SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}

export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}
export async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  await AsyncStorage.setItem(key, value);
}
async function removeStorageItem(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  await AsyncStorage.removeItem(key);
}


const SYNCED_TABLES = ['trips', 'homes', 'groups', 'friends', 'split_records', 'trip_payments', 'home_payments'] as const;

export default function SettingsScreen() {
  const { clearHistory } = useSplitStore();

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    mediumHaptic();
    setDeleteError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const uid = session.user.id;
      // Preferred path: server-side deletion of the actual auth.users row (via the
      // delete-account Edge Function, which runs with the service role). Every synced table
      // cascades on that delete, so no manual per-table cleanup is needed when this succeeds.
      const { error: fnError } = await supabase.functions.invoke('delete-account');
      if (fnError) {
        // Fallback for before the Edge Function is deployed: wipe the user's data rows so
        // "Delete account" still does something useful, but the auth identity itself survives —
        // surface that so the user isn't told something that isn't true.
        await Promise.all([
          ...SYNCED_TABLES.map((table) => supabase.from(table).delete().eq('user_id', uid)),
          supabase.from('profiles').update({ display_name: null, photo_url: null }).eq('id', uid),
        ]);
        setDeleteError('Your data was deleted, but your account couldn’t be fully removed. Contact support.');
      }
      await supabase.auth.signOut();
    }
    clearHistory();
    await removeStorageItem(PROFILE_USERNAME_KEY);
    await removeStorageItem(PROFILE_PHOTO_KEY);
    await removeStorageItem('profile_uses_shared_key');
    await removeApiKey();
    setDeleteConfirmVisible(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'Settings',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
      }} />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Danger zone */}
        <SectionLabel style={{ marginBottom: 8 }}>DANGER ZONE</SectionLabel>
        <Card onPress={() => { selectionHaptic(); setDeleteConfirmVisible(true); }} pressBorderColor={C.error}>
          <IconBadge bg={C.errorFg + '18'}>
            <TrashIcon color={C.error} size={16} />
          </IconBadge>
          <Text style={s.dangerLabel}>Delete account</Text>
        </Card>
        {deleteError && <Text style={s.errorText}>{deleteError}</Text>}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Delete confirmation */}
      <ConfirmModal
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        onConfirm={handleDeleteAccount}
        title="Delete account?"
        body="This permanently deletes your account, history, trips, groups, rats, and synced data, then signs you out. This cannot be undone."
        icon={
          <View style={{ alignItems: 'center', paddingBottom: 4 }}>
            <AlertIcon size={40} color={C.error} />
          </View>
        }
        confirmLabel="Delete Everything"
        confirmVariant="destructive"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 0 },

  errorText: { color: C.error, ...Type.cardDesc },

  dangerLabel: { flex: 1, ...Type.cardTitle, color: C.error },
});
