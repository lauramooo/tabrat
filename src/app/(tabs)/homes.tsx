import { PressBtn } from '@/components/PressBtn';
import { CheckCircleIcon, CloseCircleIcon, HomeTypeIcon, PlusIcon, ReopenIcon, SearchIcon, TrashIcon } from '@/components/FigmaIcons';
import { Button, Card, ConfirmModal, IconBadge, SectionLabel } from '@/components/design';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Animated, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { fmt } from '@/utils/calculator';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import type { Home } from '@/types';
import { ActionPill } from '@/components/ActionPill';

function HomeRow({ home, onMarkPaid, onReopen, onDelete, monthlyTotal }: {
  home: Home;
  onMarkPaid: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  monthlyTotal: number;
}) {
  const router = useRouter();
  const swipeRef = useRef<Swipeable>(null);
  const isClosed = home.status === 'closed';

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={(p) => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!isClosed ? (
            <ActionPill progress={p} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.pillPaid}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onMarkPaid(home.id); }} />
          ) : (
            <ActionPill progress={p} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.pillInfo}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onReopen(home.id); }} />
          )}
          <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onDelete(home.id); }} />
        </View>
      )}
    >
      <Card
        style={isClosed && s.homeCardClosed}
        onPress={() => { selectionHaptic(); router.push({ pathname: '/home/[id]', params: { id: home.id } } as any); }}
        pressBorderColor={C.homeBg}
      >
        <IconBadge bg={C.homeBg}>
          <HomeTypeIcon />
        </IconBadge>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.titleRow}>
            <Text style={[s.homeName, isClosed && s.closedTitle, { flex: 1 }]} numberOfLines={1}>{home.name}</Text>
            {isClosed ? (
              <View style={s.paidAmountRow}>
                <CheckCircleIcon color={C.success} size={12} />
                <Text style={s.paidAmountText}>{fmt(monthlyTotal)}</Text>
              </View>
            ) : (
              <Text style={s.homeTotal}>{fmt(monthlyTotal)}</Text>
            )}
          </View>
          <Text style={s.homeSub}>
            {home.members.length > 0 ? home.members.slice(0, 3).join(', ') : 'No members'}
          </Text>
        </View>
      </Card>
    </Swipeable>
  );
}



export default function HomesScreen() {
  const router = useRouter();
  const { homes, history, closeHome, reopenHome, deleteHome } = useSplitStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmPaid, setConfirmPaid] = useState<string | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, []));

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  function getMonthlyTotal(homeId: string) {
    return history
      .filter((r) => {
        if (r.homeId !== homeId) return false;
        const d = new Date(r.date);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return k === monthKey;
      })
      .reduce((acc, r) => acc + r.total, 0);
  }

  const q = searchQuery.toLowerCase().trim();
  const openHomes = homes.filter((h) =>
    h.status !== 'closed' && (!q || h.name.toLowerCase().includes(q) || h.members.some((m) => m.toLowerCase().includes(q)))
  );
  const closedHomes = homes.filter((h) =>
    h.status === 'closed' && (!q || h.name.toLowerCase().includes(q) || h.members.some((m) => m.toLowerCase().includes(q)))
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>Homes</Text>
          <Button
            variant="secondary"
            size="small"
            icon={<PlusIcon color={C.text} size={14} />}
            label="New home"
            onPress={() => { mediumHaptic(); router.push('/home/new' as any); }}
          />
        </View>
      </View>
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <SearchIcon color={C.text} size={16} style={{ marginLeft: 14 }} />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor={C.textDim}
          />
          {searchQuery.length > 0 && (
            <PressBtn onPress={() => setSearchQuery('')} hitSlop={8} style={{ paddingHorizontal: 14 }}>
              <CloseCircleIcon size={15} color={C.textDim} />
            </PressBtn>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {homes.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 52 }}>??</Text>
            <Text style={s.emptyTitle}>No homes yet</Text>
            <Text style={s.emptyBody}>Track shared expenses with roommates or a partner � rent, utilities, groceries, and more.</Text>
          </View>
        ) : (
          <>
            {openHomes.length > 0 && (
              <>
                <SectionLabel style={{ marginBottom: 10 }}>OPEN HOMES</SectionLabel>
                <View style={s.list}>
                  {openHomes.map((home) => (
                    <HomeRow key={home.id} home={home}
                      onMarkPaid={(id) => setConfirmPaid(id)}
                      onReopen={(id) => setConfirmReopen(id)}
                      onDelete={(id) => setConfirmDelete(id)}
                      monthlyTotal={getMonthlyTotal(home.id)}
                    />
                  ))}
                </View>
              </>
            )}
            {closedHomes.length > 0 && (
              <>
                <SectionLabel style={{ marginBottom: 10, marginTop: 24 }}>PAID HOMES</SectionLabel>
                <View style={s.list}>
                  {closedHomes.map((home) => (
                    <HomeRow key={home.id} home={home}
                      onMarkPaid={(id) => setConfirmPaid(id)}
                      onReopen={(id) => setConfirmReopen(id)}
                      onDelete={(id) => setConfirmDelete(id)}
                      monthlyTotal={getMonthlyTotal(home.id)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Confirm Mark Closed */}
      <ConfirmModal
        visible={!!confirmPaid}
        onClose={() => setConfirmPaid(null)}
        title="Mark as paid?"
        body="This home will be marked as paid."
        confirmLabel="Mark Paid"
        confirmIcon={<CheckCircleIcon color={C.text} size={16} />}
        onConfirm={() => {
          if (confirmPaid) { closeHome(confirmPaid); mediumHaptic(); }
          setConfirmPaid(null);
        }}
      />

      {/* Confirm Reopen */}
      <ConfirmModal
        visible={!!confirmReopen}
        onClose={() => setConfirmReopen(null)}
        title="Reopen home?"
        body="This home will be moved back to Open Homes."
        confirmLabel="Reopen"
        confirmIcon={<ReopenIcon size={16} color={C.text} />}
        onConfirm={() => {
          if (confirmReopen) { reopenHome(confirmReopen); mediumHaptic(); }
          setConfirmReopen(null);
        }}
      />

      {/* Confirm Delete */}
      <ConfirmModal
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete home?"
        body="This home and all its data will be permanently deleted."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (confirmDelete) { deleteHome(confirmDelete); mediumHaptic(); }
          setConfirmDelete(null);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingBottom: 90 },

  header: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, overflow: 'hidden' },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'transparent' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: 'Poppins_900Black', fontSize: 30, color: '#000000' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, overflow: 'hidden' },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, height: '100%', textAlignVertical: 'center', paddingHorizontal: 10 },

  content: { padding: 16, paddingTop: 12, flexGrow: 1 },

  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 12 },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text },
  emptyBody: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  list: { gap: 8 },
  homeCardClosed: { opacity: 0.5 },
  homeName: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  closedTitle: { color: C.textDim },
  homeSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -2 },
  homeTotal: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  paidAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidAmountText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, textDecorationLine: 'line-through' },
});
