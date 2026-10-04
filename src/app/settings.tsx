import * as SecureStore from 'expo-secure-store';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, ConfirmModal, IconBadge, Input, SectionLabel } from '@/components/design';
import { AlertIcon, CheckCircleIcon, KeyIcon, TrashIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { supabase } from '@/lib/supabase';
import { useSplitStore } from '@/store/useSplitStore';
import { successHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

export const API_KEY_STORAGE_KEY = 'anthropic_api_key';
export const PROFILE_USERNAME_KEY = 'profile_username';
export const PROFILE_PHOTO_KEY = 'profile_photo';
// Distinct from PROFILE_USERNAME_KEY (which despite its name actually holds the display name) —
// this is the unique @handle set during onboarding, for the future "add friends" lookup.
export const PROFILE_HANDLE_KEY = 'profile_handle';
// Mirrors profiles.uses_shared_key (synced on sign-in, see src/lib/authSync.ts) — true if this
// account redeemed a family/friend invite code and should use the app owner's shared Anthropic
// key instead of bringing their own. '1' when true, absent/anything else when false.
export const PROFILE_USES_SHARED_KEY = 'profile_uses_shared_key';

export { CURRENCIES } from '@/constants/currencies';

export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(API_KEY_STORAGE_KEY);
  return SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
}
export async function saveApiKey(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(API_KEY_STORAGE_KEY, key); return; }
  return SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key);
}
export async function removeApiKey(): Promise<void> {
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

  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [apiSaved, setApiSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [usesSharedKey, setUsesSharedKey] = useState(false);
  const [showCodeField, setShowCodeField] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getApiKey().then((k) => { if (k) { setApiKey(k); setSavedApiKey(k); } });
    getStorageItem(PROFILE_USES_SHARED_KEY).then((v) => { if (v === '1') setUsesSharedKey(true); });
  }, []);

  const handleRedeemCode = async () => {
    const trimmed = inviteCode.trim();
    if (!trimmed || redeeming) return;
    setRedeemError(null);
    setRedeeming(true);
    const { error } = await supabase.functions.invoke('redeem-family-code', { body: { code: trimmed } });
    setRedeeming(false);
    if (error) { setRedeemError('That code isn’t valid.'); return; }
    await setStorageItem(PROFILE_USES_SHARED_KEY, '1');
    setUsesSharedKey(true);
    setShowCodeField(false);
    setInviteCode('');
    successHaptic();
  };

  const handleSaveApiKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith('sk-ant-')) { setApiError('API keys must start with sk-ant-'); return; }
    setApiError(null);
    await saveApiKey(trimmed);
    successHaptic();
    setSavedApiKey(trimmed);
    setApiSaved(true);
    setTimeout(() => setApiSaved(false), 1800);
  };

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
    await removeStorageItem(PROFILE_USES_SHARED_KEY);
    await removeApiKey();
    setApiKey('');
    setSavedApiKey('');
    setUsesSharedKey(false);
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

        {/* API Key */}
        <SectionLabel style={{ marginBottom: 8 }}>RECEIPT SCANNING</SectionLabel>
        {usesSharedKey ? (
          <Card row={false} padding={16} style={{ marginBottom: 24, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircleIcon color={C.success} size={18} filled fillColor={C.successBg} />
              <Text style={s.apiInfo}>You're using a shared key — no setup needed.</Text>
            </View>
            <Text style={s.apiHint}>Someone invited you to scan receipts with their key. You won't need your own.</Text>
          </Card>
        ) : (
          <Card row={false} padding={16} style={{ marginBottom: 24, gap: 10 }}>
            <Text style={s.apiInfo}>
              Tab Rat uses Claude AI to read receipts. Your key is stored on-device only.
            </Text>
            <Input
              style={s.apiInput}
              value={apiKey}
              onChangeText={(t) => { setApiKey(t); setApiSaved(false); }}
              placeholder="sk-ant-..."
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={C.textDim}
            />
            {apiError && <Text style={s.errorText}>{apiError}</Text>}
            <Button
              variant="primary"
              label={apiSaved ? 'Saved!' : 'Save Key'}
              icon={<KeyIcon color={C.text} size={16} />}
              onPress={handleSaveApiKey}
              disabled={apiKey.trim() === savedApiKey.trim()}
            />
            <Text style={s.apiHint}>Get a key at console.anthropic.com</Text>

            {showCodeField ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Input
                  style={s.apiInput}
                  value={inviteCode}
                  onChangeText={(t) => { setInviteCode(t); setRedeemError(null); }}
                  placeholder="Invite code"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={C.textDim}
                  onSubmitEditing={handleRedeemCode}
                  returnKeyType="done"
                />
                {redeemError && <Text style={s.errorText}>{redeemError}</Text>}
                <Button
                  variant="secondary"
                  label={redeeming ? 'Checking…' : 'Redeem'}
                  onPress={handleRedeemCode}
                  disabled={!inviteCode.trim() || redeeming}
                />
              </View>
            ) : (
              <Button variant="tertiary" label="Have an invite code?" onPress={() => { selectionHaptic(); setShowCodeField(true); }} />
            )}
          </Card>
        )}

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

  apiInfo: { ...Type.cardDesc, color: C.textSub, lineHeight: 20 },
  apiInput: {},
  apiHint: { ...Type.cardDesc, color: C.textDim, textAlign: 'center' },
  errorText: { color: C.error, ...Type.cardDesc },

  dangerLabel: { flex: 1, ...Type.cardTitle, color: C.error },
});
