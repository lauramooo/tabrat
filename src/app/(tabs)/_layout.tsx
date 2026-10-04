import { PressBtn } from '@/components/PressBtn';
import { Tabs, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BillTypeIcon, FeedIcon, HomeTypeIcon, PlusIcon, ProfileIcon, TripTypeIcon } from '@/components/FigmaIcons';
import { Card, CenteredModal, IconBadge } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { useSplitStore } from '@/store/useSplitStore';
import { mediumHaptic, selectionHaptic } from '@/utils/haptics';

// -- Tab bar icons — each tab maps straight to its shared FigmaIcons component,
// so changing an icon there updates the tab bar automatically. --------------

const TAB_ICONS = { feed: FeedIcon, trips: TripTypeIcon, homes: HomeTypeIcon, account: ProfileIcon };

function TabIcon({ name, color, size = 22 }: { name: keyof typeof TAB_ICONS; color: string; size?: number }) {
  const Icon = TAB_ICONS[name];
  return <Icon color={color} size={size} />;
}

// -- FAB action sheet ----------------------------------------------------------

function FabSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { reset } = useSplitStore();

  const ACTIONS = [
    {
      key: 'bill', label: 'Split a bill',
      desc: 'Scan or enter a receipt to split',
      badgeBg: C.billBg, iconColor: C.billFg,
      Icon: BillTypeIcon,
      onPress: () => { onClose(); mediumHaptic(); reset(); router.push('/upload'); },
    },
    {
      key: 'trip', label: 'New trip',
      desc: 'Track shared expenses across a trip',
      badgeBg: C.tripBg, iconColor: C.tripFg,
      Icon: TripTypeIcon,
      onPress: () => { onClose(); selectionHaptic(); router.push('/trip/new' as any); },
    },
    {
      key: 'home', label: 'New home',
      desc: 'Split recurring costs with housemates',
      badgeBg: C.homeBg, iconColor: C.homeFg,
      Icon: HomeTypeIcon,
      onPress: () => { onClose(); selectionHaptic(); router.push('/home/new' as any); },
    },
  ];

  return (
    <CenteredModal visible={visible} onClose={onClose} title={<Text style={s.sheetTitle}>What do you want to do?</Text>}>
      <View style={{ gap: 10 }}>
        {ACTIONS.map((a) => (
          <Card key={a.key} style={s.actionRow} onPress={a.onPress} pressBorderColor={a.badgeBg}>
            <IconBadge bg={a.badgeBg}>
              <a.Icon color={a.iconColor} />
            </IconBadge>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>{a.label}</Text>
              <Text style={s.actionDesc}>{a.desc}</Text>
            </View>
          </Card>
        ))}
      </View>
    </CenteredModal>
  );
}

// -- Custom tab bar ------------------------------------------------------------

const TABS = [
  { name: 'index',  label: 'Feed',    figmaIcon: 'feed'    as const },
  { name: 'trips',  label: 'Trips',   figmaIcon: 'trips'   as const },
  { name: 'homes',  label: 'Homes',   figmaIcon: 'homes'   as const },
  { name: 'me',     label: 'Account', figmaIcon: 'account' as const },
] as const;

// Slot order: Feed(0) | Trips(1) | FAB | Homes(2) | Me(3)
const SLOTS: Array<number | null> = [0, 1, null, 2, 3];

function CustomTabBar({ state, navigation, onFabPress }: BottomTabBarProps & { onFabPress: (activeIndex: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.tabBarWrap}>
      <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {SLOTS.map((routeIdx, slotIdx) => {
          if (routeIdx === null) {
            return (
              <View key="fab" style={s.fabSlot}>
                <PressBtn style={s.fabBtn} onPress={() => onFabPress(state.index)} activeOpacity={0.85}>
                  <PlusIcon color={C.white} size={18} />
                </PressBtn>
              </View>
            );
          }
          const route = state.routes[routeIdx];
          const tab = TABS[routeIdx];
          const focused = state.index === routeIdx;
          return (
            <PressBtn
              key={route.key}
              style={s.tabBtn}
              activeOpacity={0.8}
              noShadow
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <View style={s.tabBtnInner}>
                <TabIcon name={tab.figmaIcon} color={focused ? C.text : C.textDim} size={22} />
                <Text style={[s.tabLabel, focused && s.tabLabelActive]}>{tab.label}</Text>
                {focused && <View style={s.tabIndicator} />}
              </View>
            </PressBtn>
          );
        })}
      </View>
    </View>
  );
}

// -- Layout export -------------------------------------------------------------

export default function TabsLayout() {
  const router = useRouter();
  const [fabVisible, setFabVisible] = useState(false);
  const tabBar = useCallback(
    (props: BottomTabBarProps) => (
      <CustomTabBar {...props} onFabPress={(activeIndex: number) => {
        if (activeIndex === 2) {
          selectionHaptic();
          router.push('/home/new' as any);
        } else {
          setFabVisible(true);
        }
      }} />
    ),
    [],
  );

  return (
    <>
      <Tabs tabBar={tabBar} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="trips" />
        <Tabs.Screen name="homes" />
        <Tabs.Screen name="me" />
      </Tabs>
      <FabSheet visible={fabVisible} onClose={() => setFabVisible(false)} />
    </>
  );
}

const s = StyleSheet.create({
  sheetTitle: { ...Type.h2, color: C.text },
  actionRow: {
    gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
  },
  actionLabel: { ...Type.buttonLg, color: C.text },
  actionDesc: { ...Type.cardDesc, color: C.textSub, marginTop: 2 },

  tabBarWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  // Flush against the bottom edge (no floating margin/pill shape). Background stays the
  // same light card color as the rest of the UI, but a top border + upward shadow keep it
  // visually separated from the cream page background instead of blending into it.
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    boxShadow: '0px -4px 12px rgba(0,0,0,0.06)',
    elevation: 10,
  },
  tabBtn: { flex: 1, alignItems: 'stretch', paddingHorizontal: 4 },
  tabBtnInner: { alignItems: 'center', gap: 2, paddingVertical: 5 },
  tabIndicator: { width: 16, height: 2.5, borderRadius: 999, backgroundColor: C.text, marginTop: 2 },
  tabLabel: { ...Type.caption, color: C.textDim },
  tabLabelActive: { color: C.text },
  fabSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.text,
    justifyContent: 'center', alignItems: 'center',
    boxShadow: '0px 4px 10px rgba(0,0,0,0.25)',
    elevation: 8,
  },
});
