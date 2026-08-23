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
import { useSplitStore } from '@/store/useSplitStore';
import { successHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

export const API_KEY_STORAGE_KEY = 'anthropic_api_key';
export const PROFILE_USERNAME_KEY = 'profile_username';
export const PROFILE_PHOTO_KEY = 'profile_photo';

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
];

export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(API_KEY_STORAGE_KEY);
  return SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
}
export async function saveApiKey(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(API_KEY_STORAGE_KEY, key); return; }
  return SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key);
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


export default function SettingsScreen() {
  const { clearHistory } = useSplitStore();

  const [apiKey, setApiKey] = useState('');
  const [apiSaved, setApiSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  useEffect(() => {
    getApiKey().then((k) => { if (k) setApiKey(k); });
  }, []);

  const handleSaveApiKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith('sk-ant-')) { setApiError('API keys must start with sk-ant-'); return; }
    setApiError(null);
    await saveApiKey(trimmed);
    successHaptic();
    setApiSaved(true);
    setTimeout(() => setApiSaved(false), 1800);
  };

  const handleDeleteAccount = async () => {
    mediumHaptic();
    clearHistory();
    await removeStorageItem(PROFILE_USERNAME_KEY);
    await removeStorageItem(PROFILE_PHOTO_KEY);
    await removeStorageItem(API_KEY_STORAGE_KEY);
    setApiKey('');
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
        <Card row={false} padding={16} style={{ marginBottom: 24, gap: 10 }}>
          <Text style={s.apiInfo}>
            SplitTab uses Claude AI to read receipts. Your key is stored on-device only.
          </Text>
          <Input
            style={s.apiInput}
            value={apiKey}
            onChangeText={(t) => { setApiKey(t); setApiSaved(false); }}
            placeholder="sk-ant-..."
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={C.textDim}
          />
          {apiError && <Text style={s.errorText}>{apiError}</Text>}
          <Button
            variant="primary"
            label={apiSaved ? 'Saved!' : 'Save Key'}
            icon={apiSaved ? <CheckCircleIcon color={C.text} size={16} /> : <KeyIcon color={C.text} size={16} />}
            onPress={handleSaveApiKey}
            style={apiSaved ? { backgroundColor: C.success } : undefined}
          />
          <Text style={s.apiHint}>Get a key at console.anthropic.com</Text>
        </Card>

        {/* Danger zone */}
        <SectionLabel style={{ marginBottom: 8 }}>DANGER ZONE</SectionLabel>
        <Card onPress={() => { selectionHaptic(); setDeleteConfirmVisible(true); }} pressBorderColor={C.error}>
          <IconBadge bg={C.errorFg + '18'}>
            <TrashIcon color={C.error} size={16} />
          </IconBadge>
          <Text style={s.dangerLabel}>Delete account</Text>
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Delete confirmation */}
      <ConfirmModal
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        onConfirm={handleDeleteAccount}
        title="Delete all data?"
        body="This will permanently delete your history, trips, groups, friends, and API key. This cannot be undone."
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

  apiInfo: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textSub, lineHeight: 20 },
  apiInput: {},
  apiHint: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.textDim, textAlign: 'center' },
  errorText: { color: C.error, fontSize: 12, fontFamily: 'Poppins_400Regular' },

  dangerLabel: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.error },
});
