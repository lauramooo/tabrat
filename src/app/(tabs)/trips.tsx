import { PressBtn } from '@/components/PressBtn';
import { BillTypeIcon, CalendarIcon, CheckCircleIcon, CircleIcon, CloseCircleIcon, PlusIcon, ProgressIcon, ReopenIcon, SearchIcon, SortIcon, TrashIcon, TripTypeIcon } from '@/components/FigmaIcons';
import { Button, Card, CircleIconButton, ConfirmModal, DatePickerModal, EditableTitle, FieldLabel, IconBadge, SectionLabel } from '@/components/design';
import { useFocusEffect, useRouter } from 'expo-router';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Platform, Pressable, ScrollView,
  StyleSheet, View,
} from 'react-native';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

function toInputDate(str: string): string {
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromInputDate(val: string): string {
  const formatted = fmtDate(val + 'T00:00:00');
  return formatted || val;
}
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { C } from '@/constants/colors';
import { Badge, InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { calculateTripSettlement, fmt } from '@/utils/calculator';
import { fmtDate } from '@/utils/date';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import type { Trip } from '@/types';
import { TextInput } from 'react-native';
import { ActionPill } from '@/components/ActionPill';

function TabPaidRow({ label, paid, amount, onToggle }: {
  label: string; paid: boolean; amount: number; onToggle: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={(p) => (
        paid ? (
          <ActionPill progress={p} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.pillInfo}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onToggle(); }} />
        ) : (
          <ActionPill progress={p} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.pillPaid}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onToggle(); }} />
        )
      )}
    >
      <View style={s.qPersonRow}>
        <IconBadge size={Badge.avatarSize} bg={paid ? '#E8F5ED' : C.billBg}>
          <BillTypeIcon color={paid ? C.success : C.billFg} size={14} />
        </IconBadge>
        <Text style={[s.qPersonName, paid && s.closedTitle]} numberOfLines={1}>{label}</Text>
        {paid ? (
          <View style={s.paidAmountRow}>
            <CheckCircleIcon color={C.success} size={13} />
            <Text style={s.paidAmountText}>{fmt(amount)}</Text>
          </View>
        ) : (
          <Text style={s.qPersonAmt}>{fmt(amount)}</Text>
        )}
      </View>
    </Swipeable>
  );
}

function TripQuickModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { trips, history, updateTrip, closeTab, reopenTab } = useSplitStore();
  const live = trips.find((t) => t.id === trip.id) ?? trip;
  const tabs = history.filter((r) => r.tripId === trip.id);

  const [name, setName] = useState(live.name);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsedStart = (() => { const d = new Date(live.startDate); return isNaN(d.getTime()) ? new Date() : d; })();
  const parsedEnd = (() => { const d = new Date(live.endDate ?? ''); return isNaN(d.getTime()) ? new Date() : d; })();

  const flash = () => {
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1600);
  };
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const commitName = (v: string) => {
    setName(v);
    updateTrip(trip.id, v, live.emoji, live.startDate, live.endDate, live.people, live.currency, live.currencies, live.budget, live.groupBudget);
    flash();
  };
  const commitStartDate = (v: string) => {
    updateTrip(trip.id, name, live.emoji, v, live.endDate, live.people, live.currency, live.currencies, live.budget, live.groupBudget);
    flash();
  };
  const commitEndDate = (v: string) => {
    updateTrip(trip.id, name, live.emoji, live.startDate, v, live.people, live.currency, live.currencies, live.budget, live.groupBudget);
    flash();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.qBackdrop} onPress={onClose}>
        <Pressable style={s.qCard} onPress={() => {}}>
          <View style={s.qTopRow}>
            <EditableTitle value={name} onChangeText={commitName} placeholder="Trip name" fallback="Trip" />
            <CircleIconButton variant="close" size={20} color={C.text} onPress={onClose} />
          </View>

          <View>
            <FieldLabel>DATES</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {Platform.OS === 'web' ? (
                <View style={[s.qDatePill, { position: 'relative' }]}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[s.qDatePillText, !live.startDate && { color: C.textDim }]}>{live.startDate || 'Start date'}</Text>
                  {createElement('input', { type: 'date', value: toInputDate(live.startDate), onChange: (e: any) => commitStartDate(fromInputDate(e.target.value)), style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any })}
                </View>
              ) : (
                <PressBtn style={s.qDatePill} onPress={() => setShowStartPicker(true)} activeOpacity={0.8}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[s.qDatePillText, !live.startDate && { color: C.textDim }]}>{live.startDate || 'Start date'}</Text>
                </PressBtn>
              )}
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <SortIcon size={13} color={C.textDim} />
              </View>
              {Platform.OS === 'web' ? (
                <View style={[s.qDatePill, { position: 'relative' }]}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[s.qDatePillText, !live.endDate && { color: C.textDim }]}>{live.endDate || 'End date'}</Text>
                  {createElement('input', { type: 'date', value: toInputDate(live.endDate ?? ''), onChange: (e: any) => commitEndDate(fromInputDate(e.target.value)), style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any })}
                </View>
              ) : (
                <PressBtn style={s.qDatePill} onPress={() => setShowEndPicker(true)} activeOpacity={0.8}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[s.qDatePillText, !live.endDate && { color: C.textDim }]}>{live.endDate || 'End date'}</Text>
                </PressBtn>
              )}
            </View>
          </View>

          {tabs.length > 0 && (
            <View>
              <FieldLabel style={{ marginTop: 2 }}>TABS</FieldLabel>
              <View style={{ gap: 12 }}>
                {tabs.map((tab) => {
                  const paid = tab.status === 'closed';
                  return (
                    <TabPaidRow
                      key={tab.id}
                      label={tab.restaurantName || 'Bill'}
                      paid={paid}
                      amount={tab.total}
                      onToggle={() => { if (paid) reopenTab(tab.id); else closeTab(tab.id); flash(); }}
                    />
                  );
                })}
              </View>
            </View>
          )}

          <View style={s.qSavedRow}>
            {savedFlash && (
              <>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={s.qSavedText}>Saved</Text>
              </>
            )}
          </View>

          {!!DateTimePicker && (
            <>
              <DatePickerModal
                visible={showStartPicker}
                value={parsedStart}
                onChange={(d) => commitStartDate(fmtDate(d))}
                onClose={() => setShowStartPicker(false)}
                title="Start date"
              />
              <DatePickerModal
                visible={showEndPicker}
                value={parsedEnd}
                onChange={(d) => commitEndDate(fmtDate(d))}
                onClose={() => setShowEndPicker(false)}
                title="End date"
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TripRow({ trip, onMarkPaid, onReopen, onDelete, onQuickEdit }: {
  trip: Trip;
  onMarkPaid: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onQuickEdit: () => void;
}) {
  const router = useRouter();
  const { history } = useSplitStore();
  const swipeRef = useRef<Swipeable>(null);
  const tabs = history.filter((r) => r.tripId === trip.id);
  const total = tabs.reduce((s, r) => s + r.total, 0);
  const isClosed = trip.status === 'closed';
  const closedTabs = tabs.filter((t) => t.status === 'closed').length;

  return (
      <Swipeable
        ref={swipeRef}
        overshootLeft={false}
        overshootRight={false}
        renderRightActions={(p) => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!isClosed ? (
              <ActionPill progress={p} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.pillPaid}
                onPress={() => { lightHaptic(); swipeRef.current?.close(); onMarkPaid(trip.id); }} />
            ) : (
              <ActionPill progress={p} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.pillInfo}
                onPress={() => { lightHaptic(); swipeRef.current?.close(); onReopen(trip.id); }} />
            )}
            <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onDelete(trip.id); }} />
          </View>
        )}
      >
        <Card
          style={isClosed && s.tripRowClosed}
          onPress={() => { selectionHaptic(); router.push({ pathname: '/trip/[id]', params: { id: trip.id } }); }}
          onLongPress={() => { lightHaptic(); onQuickEdit(); }}
          pressBorderColor={C.tripBg}
        >
          <IconBadge bg={C.tripBg}><TripTypeIcon /></IconBadge>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={s.titleRow}>
              <Text style={[s.tripName, isClosed && s.closedTitle, { flex: 1 }]} numberOfLines={1}>{trip.name}</Text>
              {isClosed ? (
                <View style={s.paidAmountRow}>
                  <CheckCircleIcon color={C.success} size={12} />
                  <Text style={s.paidAmountText}>{fmt(total)}</Text>
                </View>
              ) : (
                <Text style={s.tripTotal}>{fmt(total)}</Text>
              )}
            </View>
            {!!trip.startDate && <Text style={s.tripMeta} numberOfLines={1}>{trip.startDate}</Text>}
            {!isClosed && tabs.length > 0 && (
              <View style={s.tripPayLine}>
                {closedTabs === tabs.length ? (
                  <CheckCircleIcon size={12} color={C.success} />
                ) : closedTabs > 0 ? (
                  <ProgressIcon color={C.textDim} size={12} />
                ) : (
                  <CircleIcon color={C.textDim} size={12} />
                )}
                <Text style={[s.tripPayLineText, closedTabs === tabs.length && { color: C.success }]}>
                  {closedTabs === tabs.length ? 'All expenses paid' : `${closedTabs} of ${tabs.length} expenses paid`}
                </Text>
              </View>
            )}
          </View>
        </Card>
      </Swipeable>
  );
}

export default function TripsScreen() {
  const router = useRouter();
  const { trips, deleteTrip, closeTrip, reopenTrip } = useSplitStore();
  const [confirmPaid, setConfirmPaid] = useState<string | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [quickEditTrip, setQuickEditTrip] = useState<Trip | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(useCallback(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, []));

  const q = searchQuery.toLowerCase().trim();
  const openTrips = trips
    .filter((t) => t.status !== 'closed' && (!q || t.name.toLowerCase().includes(q)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const closedTrips = trips
    .filter((t) => t.status === 'closed' && (!q || t.name.toLowerCase().includes(q)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>Trips</Text>
          <Button
            variant="secondary"
            size="small"
            icon={<PlusIcon color={C.text} size={14} />}
            label="New trip"
            onPress={() => { mediumHaptic(); router.push('/trip/new' as any); }}
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

      {trips.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>??</Text>
          <Text style={s.emptyTitle}>No trips yet</Text>
          <Text style={s.emptyDesc}>Create a trip to track expenses across multiple tabs.</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
          {openTrips.length > 0 && (
            <>
              <SectionLabel style={{ marginBottom: 10 }}>OPEN TRIPS</SectionLabel>
              <View style={{ gap: 8 }}>
                {openTrips.map((trip) => (
                  <TripRow key={trip.id} trip={trip}
                    onMarkPaid={(id) => setConfirmPaid(id)}
                    onReopen={(id) => setConfirmReopen(id)}
                    onDelete={(id) => setConfirmDelete(id)}
                    onQuickEdit={() => setQuickEditTrip(trip)}
                  />
                ))}
              </View>
            </>
          )}
          {closedTrips.length > 0 && (
            <>
              <SectionLabel style={{ marginBottom: 10, marginTop: 24 }}>PAID TRIPS</SectionLabel>
              <View style={{ gap: 8 }}>
                {closedTrips.map((trip) => (
                  <TripRow key={trip.id} trip={trip}
                    onMarkPaid={(id) => setConfirmPaid(id)}
                    onReopen={(id) => setConfirmReopen(id)}
                    onDelete={(id) => setConfirmDelete(id)}
                    onQuickEdit={() => setQuickEditTrip(trip)}
                  />
                ))}
              </View>
            </>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>
      )}

      {/* Confirm Mark Closed */}
      <ConfirmModal
        visible={!!confirmPaid}
        onClose={() => setConfirmPaid(null)}
        title="Mark as paid?"
        body="This trip will be marked as paid."
        confirmLabel="Mark Paid"
        confirmIcon={<CheckCircleIcon color={C.text} size={16} />}
        onConfirm={() => {
          if (confirmPaid) { closeTrip(confirmPaid); mediumHaptic(); }
          setConfirmPaid(null);
        }}
      />

      {/* Confirm Reopen */}
      <ConfirmModal
        visible={!!confirmReopen}
        onClose={() => setConfirmReopen(null)}
        title="Reopen trip?"
        body="This trip will be moved back to Open Trips."
        confirmLabel="Reopen"
        confirmIcon={<ReopenIcon size={16} color={C.text} />}
        onConfirm={() => {
          if (confirmReopen) { reopenTrip(confirmReopen); mediumHaptic(); }
          setConfirmReopen(null);
        }}
      />

      {/* Confirm Delete */}
      <ConfirmModal
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete trip?"
        body="This trip and all its data will be permanently deleted."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (confirmDelete) { deleteTrip(confirmDelete); mediumHaptic(); }
          setConfirmDelete(null);
        }}
      />

      {quickEditTrip && <TripQuickModal trip={quickEditTrip} onClose={() => setQuickEditTrip(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingBottom: 90 },

  header: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'transparent' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: 'Poppins_900Black', fontSize: 30, color: '#000000' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, overflow: 'hidden' },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, height: '100%', textAlignVertical: 'center', paddingHorizontal: 10 },

  list: { flex: 1 },
  listContent: { padding: 16, paddingTop: 12 },

  tripRowClosed: { opacity: 0.5 },
  tripName: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  closedTitle: { color: C.textDim },
  tripMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -2 },
  tripTotal: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  paidAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidAmountText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, textDecorationLine: 'line-through' },

  settlementPreview: { marginTop: 2, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.card, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, gap: 4 },
  settlementRow: { flexDirection: 'row', alignItems: 'center' },
  settlementFrom: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: C.text },
  settlementTo: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: C.text },
  settlementAmt: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: C.primary },
  settlementMore: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.textSub },


  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text },
  emptyDesc: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },


  tripPayLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  tripPayLineText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.textDim },

  qBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  qCard: { backgroundColor: C.bg, borderRadius: 20, padding: 20, width: '100%', maxWidth: 420, gap: 12 },
  qTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, gap: 8 },
  qDatePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryDim, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 12 },
  qDatePillText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.text },
  qPersonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  qPersonName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  qPersonAmt: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  qSavedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 18 },
  qSavedText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: C.success },
});
