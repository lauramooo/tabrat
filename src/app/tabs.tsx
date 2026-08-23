import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  StyleSheet, View, SectionList,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, ConfirmModal, IconBadge } from '@/components/design';
import { BillTypeIcon, CheckCircleIcon, CircleIcon, PencilIcon, PlusIcon, ProgressIcon, TrashIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { useSplitStore } from '@/store/useSplitStore';
import { lightHaptic, mediumHaptic } from '@/utils/haptics';
import { fmt } from '@/utils/calculator';
import { fmtDate } from '@/utils/date';
import { ActionPill } from '@/components/ActionPill';
import type { SplitRecord } from '@/types';

function TabRow({ item, onDeleteRequest }: { item: SplitRecord; onDeleteRequest: () => void }) {
  const { loadSplit } = useSplitStore();
  const router = useRouter();
  const swipeRef = useRef<Swipeable>(null);
  const isClosed = item.status === 'closed';
  const title = item.restaurantName || 'Receipt';
  const subtitle = item.receiptDate || fmtDate(item.date);
  const people = item.fullPeople ?? [];
  const statuses = item.paymentStatuses ?? [];
  const paidById = item.paidById;
  const nonPayerStatuses = paidById ? statuses.filter((s) => s.personId !== paidById) : statuses;
  const paidCount = nonPayerStatuses.filter((s) => s.paid).length;
  const totalCount = paidById ? people.filter((p) => p.id !== paidById).length : people.length;

  const handleView = () => {
    if (!item.items || !item.fullPeople) return;
    mediumHaptic();
    loadSplit(item, true);
    router.push('/summary');
  };

  const handleEdit = () => {
    if (!item.items || !item.fullPeople) return;
    mediumHaptic();
    loadSplit(item, false);
    router.push('/review');
  };

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={(p) => (
        <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
          onPress={() => { lightHaptic(); swipeRef.current?.close(); onDeleteRequest(); }} />
      )}
      renderLeftActions={(p) => (
        <ActionPill progress={p} iconNode={(c) => <PencilIcon color={c} size={15} />} label="Edit" color={C.pillInfo}
          onPress={() => { lightHaptic(); swipeRef.current?.close(); handleEdit(); }} />
      )}
    >
      <Card style={isClosed && s.tabRowClosed} onPress={handleView} pressBorderColor={C.billBg}>
        <IconBadge bg={C.billBg}>
          <BillTypeIcon color={C.billFg} />
        </IconBadge>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.titleRow}>
            <Text style={[s.tabTitle, isClosed && s.closedTitle, { flex: 1 }]} numberOfLines={1}>{title}</Text>
            {isClosed ? (
              <View style={s.paidAmountRow}>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={s.paidAmountText}>{fmt(item.total)}</Text>
              </View>
            ) : (
              <Text style={s.tabTotal}>{fmt(item.total)}</Text>
            )}
          </View>
          {!!subtitle && <Text style={s.tabDesc} numberOfLines={1}>{subtitle}</Text>}
          {!isClosed && totalCount > 0 && (
            <View style={s.payLine}>
              {paidCount === totalCount ? (
                <CheckCircleIcon size={12} color={C.success} />
              ) : paidCount > 0 ? (
                <ProgressIcon color={C.textDim} size={12} />
              ) : (
                <CircleIcon color={C.textDim} size={12} />
              )}
              <Text style={[s.payLineText, paidCount === totalCount && { color: C.success }]}>
                {paidCount === totalCount ? 'All paid' : `${paidCount} of ${totalCount} paid`}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Swipeable>
  );
}

export default function TabsScreen() {
  const { history, deleteHistory, reset } = useSplitStore();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const standalone = history.filter((r) => !r.tripId);
  const open = standalone
    .filter((r) => r.status !== 'closed')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const closed = standalone
    .filter((r) => r.status === 'closed')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sections = [
    ...(open.length > 0 ? [{ title: 'OPEN BILLS', data: open }] : []),
    ...(closed.length > 0 ? [{ title: 'PAID BILLS', data: closed }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {sections.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>??</Text>
          <Text style={s.emptyTitle}>No tabs yet</Text>
          <Text style={s.emptyDesc}>Start a tab to split your first bill with friends.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TabRow item={item} onDeleteRequest={() => setConfirmDelete(item.id)} />}
          renderSectionHeader={({ section: { title } }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>{title}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          SectionSeparatorComponent={() => <View style={s.sectionSep} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Start a Tab"
          icon={<PlusIcon size={18} color={C.text} />}
          onPress={() => { mediumHaptic(); reset(); router.push('/upload'); }}
        />
      </View>

      <ConfirmModal
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete bill?"
        body="This will remove the bill from your history."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => { if (confirmDelete) { deleteHistory(confirmDelete); mediumHaptic(); } setConfirmDelete(null); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  listContent: { padding: 16, paddingBottom: 8 },
  sep: { height: 8 },
  sectionSep: { height: 0 },

  sectionHeader: { paddingTop: 8, paddingBottom: 8, backgroundColor: C.bg },
  sectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: C.textSub, letterSpacing: 1, textTransform: 'uppercase' },

  tabRowClosed: { opacity: 0.5 },
  tabTitle: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  closedTitle: { color: C.textDim },
  tabDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -2 },
  tabTotal: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  paidAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidAmountText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, textDecorationLine: 'line-through' },
  payLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  payLineText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.textDim },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text },
  emptyDesc: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  footer: { padding: 16, paddingTop: 8 },
});
