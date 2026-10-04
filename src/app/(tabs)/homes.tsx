import { PressBtn } from '@/components/PressBtn';
import { CheckCircleIcon, CloseCircleIcon, EmptyStateIcon, HomeTypeIcon, PlusIcon, ReopenIcon, TrashIcon } from '@/components/FigmaIcons';
import { Button, Card, ConfirmModal, IconBadge, SearchInput, SectionLabel } from '@/components/design';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Animated, ScrollView, StyleSheet,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
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
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search"
          trailing={searchQuery.length > 0 && (
            <PressBtn onPress={() => setSearchQuery('')} hitSlop={8} style={{ paddingHorizontal: 6 }}>
              <CloseCircleIcon size={15} color={C.textDim} />
            </PressBtn>
          )}
        />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {homes.length === 0 ? (
          <View style={s.empty}>
            <EmptyStateIcon size={52} />
            <Text style={s.emptyTitle}>No homes yet</Text>
            <Text style={s.emptyBody}>Track shared expenses with roommates or a partner — rent, utilities, groceries, and more.</Text>
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
  headerTitle: { ...Type.display, color: '#000000' },

  content: { padding: 16, paddingTop: 12, flexGrow: 1 },

  // flex: 1 + justifyContent: 'center' matches Trips'/Feed's empty state exactly — relies on
  // `content` above having flexGrow: 1 so it can actually center within the full screen height
  // rather than just the ScrollView's (otherwise zero) content height.
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { ...Type.emptyTitle, color: C.text },
  // minHeight = 3 lines at this lineHeight — this is the longest of the three tabs' empty-state
  // copy, so Trips'/Feed's shorter descriptions reserve the same space and don't shift their icon.
  emptyBody: { ...Type.bodySmall, color: C.textSub, textAlign: 'center', lineHeight: 24, minHeight: 66 },

  list: { gap: 8 },
  homeCardClosed: { opacity: 0.5 },
  homeName: { ...Type.cardTitle, color: C.text },
  closedTitle: { color: C.textDim },
  homeSub: { ...Type.cardDesc, color: C.textSub, marginTop: -2 },
  homeTotal: { ...Type.cardTitle, color: C.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  paidAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidAmountText: { ...Type.cardTitle, color: C.textSub, textDecorationLine: 'line-through' },
});
