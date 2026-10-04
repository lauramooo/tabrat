import * as ImagePicker from 'expo-image-picker';
import { PressBtn } from '@/components/PressBtn';
import { ProfilePhotoButton } from '@/components/ProfilePhotoButton';
import {
  BugIcon, CameraIcon, CheckCircleIcon, LightbulbIcon, LogoutIcon, MessageBubbleIcon, MoneyIcon,
  PhotoIcon, SettingsIcon, TrashIcon, UserIcon, UserMultipleIcon,
} from '@/components/FigmaIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, CenteredModal, CircleIconButton, Divider, EditableTitle, IconBadge, SectionLabel } from '@/components/design';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { supabase } from '@/lib/supabase';
import { syncProfileIdentity } from '@/lib/sync';
import { useSplitStore } from '@/store/useSplitStore';
import { CURRENCIES, PROFILE_HANDLE_KEY, PROFILE_PHOTO_KEY, PROFILE_USERNAME_KEY, getStorageItem, setStorageItem } from '@/app/settings';
import { lightHaptic, selectionHaptic } from '@/utils/haptics';

const SUPPORT_EMAIL = 'miss.lauramolano@gmail.com';

// On web, both Linking.openURL('mailto:...') and a target="_blank" anchor/window.open risk
// navigating THIS tab away: if the browser's popup blocker rejects the new-tab attempt, some
// browsers fall back to same-tab navigation, and since mailto: isn't a real page, the resulting
// cancelled/failed navigation can reset this single-page app back to its default route — which is
// exactly the "ends up on Feed" bug this was reported as. A hidden iframe sidesteps that entirely:
// setting its src to a mailto: URL still hands off to the OS mail client, but the attempt is
// scoped to the isolated iframe's own browsing context, so it can never affect (or be blocked in
// a way that falls back to) this tab's own location. Native doesn't have this problem; mailto:
// there suspends the app in place and returns to the same screen.
function openSupportEmail(subject: string) {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  if (Platform.OS === 'web') {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentWindow?.location.assign(url);
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

function NavCard({ Icon, badgeBg, badgeFg, label, sub, onPress }: {
  Icon: React.ComponentType<{ color?: string; size?: number }>;
  badgeBg: string; badgeFg: string; label: string; sub?: string; onPress: () => void;
}) {
  return (
    <Card onPress={() => { selectionHaptic(); onPress(); }} pressBorderColor={badgeBg}>
      <IconBadge bg={badgeBg}>
        <Icon color={badgeFg} size={16} />
      </IconBadge>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.cardTitle} numberOfLines={1}>{label}</Text>
        {!!sub && <Text style={s.cardDesc} numberOfLines={1}>{sub}</Text>}
      </View>
    </Card>
  );
}

export default function MeScreen() {
  const router = useRouter();
  const { friends, groups, defaultCurrency, setDefaultCurrency } = useSplitStore();
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, []));

  const [username, setUsername] = useState('');
  const [handle, setHandle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  useEffect(() => {
    getStorageItem(PROFILE_USERNAME_KEY).then((u) => { if (u) setUsername(u); });
    getStorageItem(PROFILE_HANDLE_KEY).then((h) => { if (h) setHandle(h); });
    getStorageItem(PROFILE_PHOTO_KEY).then((p) => { if (p) setPhotoUri(p); });
  }, []);

  const handleLogOut = () => {
    selectionHaptic();
    supabase.auth.signOut();
  };

  const commitUsername = (v: string) => {
    setUsername(v);
    setStorageItem(PROFILE_USERNAME_KEY, v.trim());
    syncProfileIdentity({ displayName: v.trim() });
  };

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
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      await setStorageItem(PROFILE_PHOTO_KEY, uri);
      syncProfileIdentity({ photoUrl: uri });
    }
  };

  const handleRemovePhoto = async () => {
    lightHaptic();
    setPhotoUri(null);
    await setStorageItem(PROFILE_PHOTO_KEY, '');
    syncProfileIdentity({ photoUrl: null });
    setPhotoSheetVisible(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={s.header}>
          <ProfilePhotoButton photoUri={photoUri} size={64} onPress={() => { selectionHaptic(); setPhotoSheetVisible(true); }} />
          <View style={{ flex: 1, gap: 6 }}>
            <EditableTitle value={username} onChangeText={commitUsername} placeholder="Your name" fallback="Set your name" />
            {!!handle && <Text style={s.handleText}>@{handle}</Text>}
            <PressBtn style={s.currencyPill} onPress={() => { selectionHaptic(); setCurrencyPickerVisible(true); }} activeOpacity={0.7}>
              <MoneyIcon size={13} color={C.textSub} />
              <Text style={s.currencyPillText}>{defaultCurrency ?? 'USD'}</Text>
            </PressBtn>
          </View>
        </View>

        {/* Social */}
        <SectionLabel style={{ marginBottom: 8 }}>SOCIAL</SectionLabel>
        <View style={s.cardList}>
          <NavCard
            Icon={UserIcon}
            badgeBg={C.tripBg} badgeFg={C.tripFg}
            label="Rats"
            sub={friends.length > 0 ? `${friends.length} rat${friends.length !== 1 ? 's' : ''}` : 'Add rats'}
            onPress={() => router.push('/friends')}
          />
          <NavCard
            Icon={UserMultipleIcon}
            badgeBg={C.tripBg} badgeFg={C.tripFg}
            label="Groups"
            sub={groups.length > 0 ? `${groups.length} group${groups.length !== 1 ? 's' : ''}` : 'Create a group'}
            onPress={() => router.push('/groups')}
          />
        </View>

        {/* Contact us */}
        <SectionLabel style={{ marginTop: 24, marginBottom: 8 }}>CONTACT US</SectionLabel>
        <View style={s.cardList}>
          <NavCard
            Icon={LightbulbIcon}
            badgeBg={C.billBg} badgeFg={C.billFg}
            label="Submit an idea"
            sub="Tell us what you'd like to see"
            onPress={() => router.push('/roadmap?type=idea' as any)}
          />
          <NavCard
            Icon={BugIcon}
            badgeBg={C.billBg} badgeFg={C.billFg}
            label="Report a bug"
            sub="Something not working right?"
            onPress={() => router.push('/roadmap?type=bug' as any)}
          />
          <NavCard
            Icon={MessageBubbleIcon}
            badgeBg={C.billBg} badgeFg={C.billFg}
            label="Contact us"
            sub="Get in touch directly"
            onPress={() => openSupportEmail('Tab Rat Feedback')}
          />
        </View>

        {/* Settings */}
        <SectionLabel style={{ marginTop: 24, marginBottom: 8 }}>SETTINGS</SectionLabel>
        <View style={s.cardList}>
          <NavCard
            Icon={SettingsIcon}
            badgeBg={C.homeBg} badgeFg={C.homeFg}
            label="Settings"
            sub="Receipt scanning, data"
            onPress={() => router.push('/settings')}
          />
        </View>

        <Button
          variant="secondary"
          size="big"
          label="Log out"
          icon={<LogoutIcon size={16} color={C.text} />}
          onPress={handleLogOut}
          style={{ marginTop: 24 }}
        />

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Photo action sheet */}
      <CenteredModal visible={photoSheetVisible} onClose={() => setPhotoSheetVisible(false)} padding={24} title={<Text style={s.sheetTitle}>Profile photo</Text>}>
        <View style={{ gap: 10 }}>
          <Card onPress={() => { setPhotoSheetVisible(false); pickPhoto('camera'); }} pressBorderColor={AVATAR_PALETTE[0].bg}>
            <IconBadge bg={AVATAR_PALETTE[0].bg}>
              <CameraIcon size={16} color={AVATAR_PALETTE[0].text} />
            </IconBadge>
            <Text style={s.cardTitle}>Take photo</Text>
          </Card>
          <Card onPress={() => { setPhotoSheetVisible(false); pickPhoto('library'); }} pressBorderColor={AVATAR_PALETTE[1].bg}>
            <IconBadge bg={AVATAR_PALETTE[1].bg}>
              <PhotoIcon size={16} color={AVATAR_PALETTE[1].text} />
            </IconBadge>
            <Text style={s.cardTitle}>Upload photo</Text>
          </Card>
          {photoUri && (
            <Card onPress={handleRemovePhoto} pressBorderColor={C.error}>
              <IconBadge bg={C.errorFg + '18'}>
                <TrashIcon size={16} color={C.error} />
              </IconBadge>
              <Text style={[s.cardTitle, { color: C.error }]}>Remove photo</Text>
            </Card>
          )}
        </View>
      </CenteredModal>

      {/* Currency picker */}
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
                style={[s.currencyRow, defaultCurrency === c.code && s.currencyRowActive]}
                onPress={() => { lightHaptic(); setDefaultCurrency(c.code); setCurrencyPickerVisible(false); }}
                activeOpacity={0.7}
              >
                <Text style={s.currencySymbol}>{c.symbol}</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={s.currencyCode}>{c.code}</Text>
                  <Text style={s.currencyName} numberOfLines={1}>{c.name}</Text>
                </View>
                {defaultCurrency === c.code && (
                  <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} />
                )}
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
  safe: { flex: 1, backgroundColor: C.bg, paddingBottom: 90 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 },
  handleText: { ...Type.labelMedium, color: C.textDim },
  currencyPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  currencyPillText: { ...Type.labelMedium, color: C.textSub },

  cardList: { gap: 8 },
  cardTitle: { ...Type.cardTitle, color: C.text },
  cardDesc: { ...Type.cardDesc, color: C.textSub, marginTop: -2 },

  sheetTitle: { ...Type.h2, color: C.text, lineHeight: 26 },

  // Currency picker
  currencyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  currencyHeaderTitle: { fontFamily: 'Poppins_900Black', fontSize: 20, color: C.text, lineHeight: 24 },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
  currencyRowActive: { backgroundColor: C.primaryDim },
  currencySymbol: { width: 36, ...Type.pillLabel, color: C.primary, textAlign: 'center' },
  currencyCode: { ...Type.pillLabel, color: C.text },
  currencyName: { flex: 1, ...Type.cardDesc, color: C.textSub },
});
