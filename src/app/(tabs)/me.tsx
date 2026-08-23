import * as ImagePicker from 'expo-image-picker';
import { PressBtn } from '@/components/PressBtn';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import {
  BugIcon, CameraIcon, CheckCircleIcon, LightbulbIcon, MessageBubbleIcon, MoneyIcon,
  SettingsIcon, TrashIcon, UserIcon, UserMultipleIcon,
} from '@/components/FigmaIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Card, CenteredModal, CircleIconButton, Divider, EditableTitle, IconBadge, SectionLabel } from '@/components/design';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { useSplitStore } from '@/store/useSplitStore';
import { CURRENCIES, PROFILE_PHOTO_KEY, PROFILE_USERNAME_KEY, getStorageItem, setStorageItem } from '@/app/settings';
import { lightHaptic, selectionHaptic } from '@/utils/haptics';

const SUPPORT_EMAIL = 'miss.lauramolano@gmail.com';

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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  useEffect(() => {
    getStorageItem(PROFILE_USERNAME_KEY).then((u) => { if (u) setUsername(u); });
    getStorageItem(PROFILE_PHOTO_KEY).then((p) => { if (p) setPhotoUri(p); });
  }, []);

  const commitUsername = (v: string) => {
    setUsername(v);
    setStorageItem(PROFILE_USERNAME_KEY, v.trim());
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
    }
  };

  const handleRemovePhoto = async () => {
    lightHaptic();
    setPhotoUri(null);
    await setStorageItem(PROFILE_PHOTO_KEY, '');
    setPhotoSheetVisible(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={s.header}>
          <PressBtn onPress={() => { selectionHaptic(); setPhotoSheetVisible(true); }} activeOpacity={0.8}>
            <ProfileAvatar photoUri={photoUri} size={64} />
          </PressBtn>
          <View style={{ flex: 1, gap: 6 }}>
            <EditableTitle value={username} onChangeText={commitUsername} placeholder="Your name" fallback="Set your name" />
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
            badgeBg={AVATAR_PALETTE[0].bg} badgeFg={AVATAR_PALETTE[0].text}
            label="Friends"
            sub={friends.length > 0 ? `${friends.length} friend${friends.length !== 1 ? 's' : ''}` : 'Add friends'}
            onPress={() => router.push('/friends')}
          />
          <NavCard
            Icon={UserMultipleIcon}
            badgeBg={AVATAR_PALETTE[1].bg} badgeFg={AVATAR_PALETTE[1].text}
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
            badgeBg={AVATAR_PALETTE[2].bg} badgeFg={AVATAR_PALETTE[2].text}
            label="Submit an idea"
            sub="Tell us what you'd like to see"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Open Tab Idea`)}
          />
          <NavCard
            Icon={BugIcon}
            badgeBg={AVATAR_PALETTE[3].bg} badgeFg={AVATAR_PALETTE[3].text}
            label="Report a bug"
            sub="Something not working right?"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Open Tab Bug`)}
          />
          <NavCard
            Icon={MessageBubbleIcon}
            badgeBg={AVATAR_PALETTE[4].bg} badgeFg={AVATAR_PALETTE[4].text}
            label="Contact us"
            sub="Get in touch directly"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Open Tab Feedback`)}
          />
        </View>

        {/* Settings */}
        <SectionLabel style={{ marginTop: 24, marginBottom: 8 }}>SETTINGS</SectionLabel>
        <View style={s.cardList}>
          <NavCard
            Icon={SettingsIcon}
            badgeBg={AVATAR_PALETTE[0].bg} badgeFg={AVATAR_PALETTE[0].text}
            label="Settings"
            sub="Receipt scanning, data"
            onPress={() => router.push('/settings')}
          />
        </View>

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
              <MaterialCommunityIcons name="image-outline" size={16} color={AVATAR_PALETTE[1].text} />
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
                  <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" />
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
  currencyPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  currencyPillText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.textSub },

  cardList: { gap: 8 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  cardDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -2 },

  sheetTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text, lineHeight: 26 },

  // Currency picker
  currencyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  currencyHeaderTitle: { fontFamily: 'Poppins_900Black', fontSize: 20, color: C.text, lineHeight: 24 },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
  currencyRowActive: { backgroundColor: C.primaryDim },
  currencySymbol: { width: 36, fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: C.primary, textAlign: 'center' },
  currencyCode: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: C.text },
  currencyName: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textSub },
});
