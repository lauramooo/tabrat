import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, CenteredModal, CircleIconButton, Divider, FieldLabel, Input } from '@/components/design';
import { CameraIcon, CheckCircleIcon, MoneyIcon, PhotoIcon, TrashIcon } from '@/components/FigmaIcons';
import { PressBtn } from '@/components/PressBtn';
import { ProfilePhotoButton } from '@/components/ProfilePhotoButton';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { CURRENCIES, PROFILE_HANDLE_KEY, PROFILE_PHOTO_KEY, PROFILE_USERNAME_KEY, PROFILE_USES_SHARED_KEY, setStorageItem } from '@/app/settings';
import { supabase } from '@/lib/supabase';
import { useSplitStore } from '@/store/useSplitStore';
import { errorMessage } from '@/utils/errors';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

// Shown once, right after a session first exists, whenever the signed-in account has no username
// yet (see the `needsOnboarding` check in _layout.tsx) — covers both a brand-new signup and an
// existing account that never finished this step. There's no way to skip past it: name, a unique
// username, and a currency are all required before `onComplete` unblocks the rest of the app.
export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const setDefaultCurrency = useSplitStore((s) => s.setDefaultCurrency);

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [inviteCode, setInviteCode] = useState('');
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth providers (Google especially — Apple rarely shares more than email) hand back a name
  // and photo in user_metadata. Prefill with it, but every field stays editable either way.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      const prefillName = meta.full_name ?? meta.name;
      const prefillPhoto = meta.avatar_url ?? meta.picture;
      if (typeof prefillName === 'string' && prefillName) setName(prefillName);
      if (typeof prefillPhoto === 'string' && prefillPhoto) setPhotoUri(prefillPhoto);
    });
  }, []);

  const pickPhoto = async (source: 'library' | 'camera') => {
    let result;
    if (source === 'library') {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    } else {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    }
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // Not a pushed screen, so there's nowhere in navigation history to go "back" to — this signs
  // out and drops back to AuthGate instead, which is the only sensible exit from a blocking step.
  const handleBack = () => {
    selectionHaptic();
    supabase.auth.signOut();
  };

  const canContinue = name.trim().length > 0 && HANDLE_PATTERN.test(handle.trim());

  const handleContinue = async () => {
    const trimmedName = name.trim();
    const trimmedHandle = handle.trim();
    if (!trimmedName) { setError('Enter your name.'); return; }
    if (!HANDLE_PATTERN.test(trimmedHandle)) {
      setError('Username must be 3-20 characters — letters, numbers, and underscores only.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data: available, error: checkError } = await supabase.rpc('is_username_available', { check_username: trimmedHandle });
      if (checkError) throw checkError;
      if (!available) { setError('That username is already taken.'); setLoading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');

      const { error: updateError } = await supabase.from('profiles').update({
        display_name: trimmedName,
        username: trimmedHandle,
        photo_url: photoUri,
        default_currency: currency,
      }).eq('id', user.id);

      if (updateError) {
        // Defense-in-depth against a race with someone else claiming the same username between
        // the availability check above and this write — the unique index is the real guarantee.
        if (updateError.code === '23505') { setError('That username is already taken.'); setLoading(false); return; }
        throw updateError;
      }

      await setStorageItem(PROFILE_USERNAME_KEY, trimmedName);
      await setStorageItem(PROFILE_HANDLE_KEY, trimmedHandle);
      if (photoUri) await setStorageItem(PROFILE_PHOTO_KEY, photoUri);
      setDefaultCurrency(currency);

      // Best-effort — a mistyped/invalid code shouldn't block finishing onboarding, it just
      // means they'll bring their own key later like anyone else.
      const trimmedInviteCode = inviteCode.trim();
      if (trimmedInviteCode) {
        const { error: redeemError } = await supabase.functions.invoke('redeem-family-code', { body: { code: trimmedInviteCode } });
        if (!redeemError) await setStorageItem(PROFILE_USES_SHARED_KEY, '1');
      }

      mediumHaptic();
      onComplete();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.headerRow}>
            <CircleIconButton variant="back" size={28} color={C.primary} onPress={handleBack} />
            <Text style={s.title}>Set up your profile</Text>
          </View>
          <Text style={s.subtitle}>You can change any of this later in Settings.</Text>

          <View style={s.photoWrap}>
            <ProfilePhotoButton photoUri={photoUri} size={84} onPress={() => { selectionHaptic(); setPhotoSheetVisible(true); }} />
          </View>

          <View style={{ gap: 6, marginTop: 24 }}>
            <FieldLabel style={{ marginBottom: 0 }}>NAME</FieldLabel>
            <Input value={name} onChangeText={(t) => { setName(t); setError(null); }} placeholder="Your name" autoCorrect={false} />
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel style={{ marginBottom: 0 }}>USERNAME</FieldLabel>
            <Input
              value={handle}
              onChangeText={(t) => { setHandle(t.replace(/\s/g, '')); setError(null); }}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.hint}>3-20 characters — letters, numbers, and underscores. Used later for adding rats.</Text>
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel style={{ marginBottom: 0 }}>CURRENCY</FieldLabel>
            <PressBtn style={s.currencyRow} onPress={() => { selectionHaptic(); setCurrencyPickerVisible(true); }} activeOpacity={0.7}>
              <MoneyIcon size={14} color={C.textSub} />
              <Text style={s.currencyRowText}>{CURRENCIES.find((c) => c.code === currency)?.name ?? currency} ({currency})</Text>
            </PressBtn>
          </View>

          <View style={{ gap: 6, marginTop: 16 }}>
            <FieldLabel style={{ marginBottom: 0 }}>INVITE CODE (OPTIONAL)</FieldLabel>
            <Input
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Have a code from a rat?"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {error && <Text style={s.errorText}>{error}</Text>}

          <Button
            variant="primary"
            size="big"
            label={loading ? 'Please wait...' : 'Continue'}
            onPress={handleContinue}
            disabled={loading || !canContinue}
            style={{ marginTop: 24 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Photo action sheet — same options as the Account screen's profile photo picker */}
      <CenteredModal visible={photoSheetVisible} onClose={() => setPhotoSheetVisible(false)} padding={24} title={<Text style={s.sheetTitle}>Profile photo</Text>}>
        <View style={{ gap: 10 }}>
          <PressBtn style={s.sheetRow} onPress={() => { setPhotoSheetVisible(false); pickPhoto('camera'); }} activeOpacity={0.7}>
            <CameraIcon size={16} color={C.text} />
            <Text style={s.cardTitle}>Take photo</Text>
          </PressBtn>
          <PressBtn style={s.sheetRow} onPress={() => { setPhotoSheetVisible(false); pickPhoto('library'); }} activeOpacity={0.7}>
            <PhotoIcon size={16} color={C.text} />
            <Text style={s.cardTitle}>Upload photo</Text>
          </PressBtn>
          {photoUri && (
            <PressBtn style={s.sheetRow} onPress={() => { lightHaptic(); setPhotoUri(null); setPhotoSheetVisible(false); }} activeOpacity={0.7}>
              <TrashIcon size={16} color={C.error} />
              <Text style={[s.cardTitle, { color: C.error }]}>Remove photo</Text>
            </PressBtn>
          )}
        </View>
      </CenteredModal>

      {/* Currency picker — same list/pattern as the Account screen's currency picker */}
      <CenteredModal visible={currencyPickerVisible} onClose={() => setCurrencyPickerVisible(false)} padding={0} showClose={false}>
        <View>
          <View style={s.currencyHeader}>
            <Text style={s.currencyHeaderTitle}>Currency</Text>
            <CircleIconButton variant="close" size={20} color={C.text} onPress={() => setCurrencyPickerVisible(false)} />
          </View>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {CURRENCIES.map((c, i) => (
              <View key={c.code}>
                {i > 0 && <Divider />}
                <PressBtn
                  style={[s.currencyPickerRow, currency === c.code && s.currencyPickerRowActive]}
                  onPress={() => { lightHaptic(); setCurrency(c.code); setCurrencyPickerVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={s.currencySymbol}>{c.symbol}</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={s.currencyCode}>{c.code}</Text>
                    <Text style={s.currencyName} numberOfLines={1}>{c.name}</Text>
                  </View>
                  {currency === c.code && <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} />}
                </PressBtn>
              </View>
            ))}
          </ScrollView>
        </View>
      </CenteredModal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  // paddingHorizontal matches trip/expenses.tsx's own body content padding (its `section` style)
  // exactly, so the back button — which has no separate native header to sit in here — lines up
  // with the same left edge as everything else on the screen, not an approximated inset.
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Poppins_900Black', fontSize: 20, color: C.text },
  subtitle: { ...Type.cardDesc, color: C.textSub, marginTop: 4, marginLeft: 36 },

  photoWrap: { alignSelf: 'center', marginTop: 24 },

  hint: { ...Type.cardDesc, color: C.textDim, marginTop: 2 },

  currencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card,
    borderRadius: 14, height: 48, paddingHorizontal: 14,
  },
  currencyRowText: { ...Type.labelMedium, color: C.text },

  errorText: { color: C.error, fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 12 },

  sheetTitle: { ...Type.h2, color: C.text, lineHeight: 26 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  cardTitle: { ...Type.cardTitle, color: C.text },

  currencyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  currencyHeaderTitle: { fontFamily: 'Poppins_900Black', fontSize: 20, color: C.text, lineHeight: 24 },
  currencyPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
  currencyPickerRowActive: { backgroundColor: C.primaryDim },
  currencySymbol: { width: 36, ...Type.pillLabel, color: C.primary, textAlign: 'center' },
  currencyCode: { ...Type.pillLabel, color: C.text },
  currencyName: { flex: 1, ...Type.cardDesc, color: C.textSub },
});
