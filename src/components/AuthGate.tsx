import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Divider, FieldLabel, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { AppleLogoIcon, EyeIcon, EyeOffIcon, GoogleLogoIcon, HandCardLeft, HandCardRight } from '@/components/FigmaIcons';
import { PressBtn } from '@/components/PressBtn';
import { type OAuthProvider, signInWithOAuth } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/utils/errors';
import { mediumHaptic, selectionHaptic } from '@/utils/haptics';

const OAUTH_ICONS: Record<OAuthProvider, React.ReactElement> = {
  google: <GoogleLogoIcon size={32} />,
  apple: <AppleLogoIcon size={32} />,
};

// The very first thing an unauthenticated user sees — rendered directly by the root layout in
// place of the app (not a routed/pushed screen), so there's nowhere to navigate "back" to.
// Signing in/up resolves via the auth-state listener in _layout.tsx, which swaps this out for
// the real app automatically.
export function AuthGate() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'signin' | 'signup' | OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = loadingAction !== null;

  const handleOAuth = async (provider: OAuthProvider) => {
    setError(null);
    setLoadingAction(provider);
    try {
      await signInWithOAuth(provider);
      mediumHaptic();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAuth = async (mode: 'signin' | 'signup') => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) { setError('Enter an email and password.'); return; }
    setError(null);
    setLoadingAction(mode);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email: trimmedEmail, password });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (signInError) throw signInError;
      }
      mediumHaptic();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.center}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <View style={s.hero}>
            <View style={s.handLeft}>
              <HandCardLeft size={170} />
            </View>
            <HandCardRight size={170} />
          </View>

          <View style={s.content}>
            <Text style={s.appName}>Tab Rat</Text>

            <View style={s.form}>
              <View style={{ gap: 6 }}>
                <FieldLabel style={{ marginBottom: 0 }}>EMAIL</FieldLabel>
                <Input
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(null); }}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </View>

              <View style={{ gap: 6, marginTop: 16 }}>
                <FieldLabel style={{ marginBottom: 0 }}>PASSWORD</FieldLabel>
                <View style={s.passwordWrap}>
                  <Input
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(null); }}
                    placeholder="••••••••"
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    onSubmitEditing={() => handleAuth('signin')}
                    returnKeyType="done"
                    style={{ paddingRight: 44 }}
                  />
                  <PressBtn
                    style={s.passwordToggle}
                    onPress={() => setPasswordVisible((v) => !v)}
                    activeOpacity={0.6}
                    noShadow
                  >
                    {passwordVisible ? <EyeIcon size={17} /> : <EyeOffIcon size={17} />}
                  </PressBtn>
                </View>
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.authRow}>
                <Button
                  variant="secondary"
                  size="big"
                  label={loadingAction === 'signin' ? 'Please wait...' : 'Sign in'}
                  onPress={() => handleAuth('signin')}
                  disabled={loading}
                  style={{ flex: 1 }}
                />
                <Button
                  variant="primary"
                  size="big"
                  label={loadingAction === 'signup' ? 'Please wait...' : 'Sign up'}
                  onPress={() => handleAuth('signup')}
                  disabled={loading}
                  style={{ flex: 1 }}
                />
              </View>

              <View style={s.dividerRow}>
                <Divider style={s.dividerLine} />
                <Text style={s.dividerText}>or continue with</Text>
                <Divider style={s.dividerLine} />
              </View>

              <View style={s.oauthRow}>
                {(['apple', 'google'] as const).map((provider) => (
                  <PressBtn
                    key={provider}
                    style={s.oauthCircleWrap}
                    onPress={() => { selectionHaptic(); handleOAuth(provider); }}
                    disabled={loading}
                    activeOpacity={0.75}
                    noShadow
                  >
                    <View style={[s.oauthCircle, loadingAction === provider && s.oauthCircleActive]}>
                      {OAUTH_ICONS[provider]}
                    </View>
                  </PressBtn>
                ))}
              </View>
            </View>
          </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', width: '100%', paddingTop: 40, paddingBottom: 40 },
  // Full-bleed row, no horizontal inset — the hands are pinned to the true screen edges via
  // space-between, so the gap between them (not their size or position relative to the edge) is
  // what shrinks as the viewport narrows. The 24px inset that used to live on `center` moved down
  // to `content` so it only affects the title/form, not this row.
  hero: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginBottom: 20,
  },
  content: { width: '100%', alignItems: 'center', paddingHorizontal: 24 },
  handLeft: { marginTop: -150 },
  appName: { ...Type.hero, color: C.text, marginBottom: 32, textTransform: 'uppercase' },
  form: { width: '100%', maxWidth: 340 },
  passwordWrap: { justifyContent: 'center' },
  passwordToggle: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center' },
  authRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 10 },
  dividerLine: { flex: 1 },
  dividerText: { ...Type.caption, color: C.textSub },
  // Matches trip/expenses.tsx's day-picker circles (dayBadgeCircle/dayStripAllPill) — transparent
  // by default, filled solid only while active. Yellow here instead of that screen's trip-pink,
  // and "active" means "this provider's sign-in is in flight" rather than "selected."
  oauthRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  oauthCircleWrap: { alignItems: 'center', justifyContent: 'center' },
  oauthCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  oauthCircleActive: { backgroundColor: C.yellow },
  errorText: { ...Type.cardDesc, color: C.error, marginTop: 12 },
});
