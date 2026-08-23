import { PressBtn } from '@/components/PressBtn';
import { useFocusEffect, useRouter } from 'expo-router';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, Platform, Pressable, ScrollView,
  StyleSheet, TextInput, View,
} from 'react-native';
import { ActionPill } from '@/components/ActionPill';
import { Avatar } from '@/components/Avatar';
import { BillTypeIcon, CalendarIcon, CheckCircleIcon, CircleIcon, CloseCircleIcon, HomeTypeIcon, PlusIcon, ProgressIcon, ReopenIcon, SearchIcon, SortIcon, TrashIcon, TripTypeIcon } from '@/components/FigmaIcons';
import { Button, Card, CircleIconButton, ConfirmModal, DatePickerModal, EditableTitle, FieldLabel, IconBadge, SectionLabel } from '@/components/design';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { C } from '@/constants/colors';
import { Badge, InputMetrics, Radius } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import { fmt } from '@/utils/calculator';
import { fmtDate, fmtMonthYear, parseLocalDate } from '@/utils/date';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import type { SplitRecord, Trip } from '@/types';

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
// -- Quick-edit modal ----------------------------------------------------------

function PersonPaidRow({ name, index, paid, amount, onToggle }: {
  name: string; index: number; paid: boolean; amount: number; onToggle: () => void;
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
      <View style={qst.personRow}>
        <Avatar name={name} index={index} size={Badge.avatarSize} />
        <Text style={[qst.personName, paid && st.closedTitle]} numberOfLines={1}>{name}</Text>
        {paid ? (
          <View style={st.paidAmountRow}>
            <CheckCircleIcon color={C.success} size={13} />
            <Text style={st.paidAmountText}>{fmt(amount)}</Text>
          </View>
        ) : (
          <Text style={qst.personAmt}>{fmt(amount)}</Text>
        )}
      </View>
    </Swipeable>
  );
}

function QuickEditModal({ item, onClose }: { item: SplitRecord; onClose: () => void }) {
  const { updateRecord, setPersonPaid, history } = useSplitStore();

  // Always read live record so payment toggles reflect immediately
  const live = history.find((r) => r.id === item.id) ?? item;

  const [name, setName] = useState(live.restaurantName ?? '');
  const [date, setDate] = useState(live.receiptDate ? (fmtDate(live.receiptDate) || live.receiptDate) : '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedDate = (() => { const d = new Date(date); return isNaN(d.getTime()) ? new Date() : d; })();

  const flash = () => {
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1600);
  };
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const commitName = (v: string) => { setName(v); updateRecord(item.id, { restaurantName: v }); flash(); };
  const commitDate = (v: string) => { setDate(v); updateRecord(item.id, { receiptDate: v }); flash(); };

  const myName = useMyName();
  const people = sortWithMeFirst(live.fullPeople ?? [], myName);
  const amounts = live.personAmounts ?? [];
  const statuses = live.paymentStatuses ?? [];
  const paidById = live.paidById;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={qst.backdrop} onPress={onClose}>
        <Pressable style={qst.card} onPress={() => {}}>
          <View style={qst.topRow}>
            <EditableTitle value={name} onChangeText={commitName} placeholder="Bill title" fallback="Receipt" />
            <CircleIconButton variant="close" size={20} color={C.text} onPress={onClose} />
          </View>

          {/* Date */}
          <View>
            <FieldLabel>DATE</FieldLabel>
            {Platform.OS === 'web' ? (
              <View style={[qst.datePillWrap, { position: 'relative' }]}>
                <CalendarIcon size={15} color={C.text} />
                <Text style={[qst.datePillText, !date && { color: C.textDim }]}>{(date && (fmtDate(date) || date)) || 'Set date'}</Text>
                {createElement('input', {
                  type: 'date',
                  value: toInputDate(date),
                  onChange: (e: any) => commitDate(fromInputDate(e.target.value)),
                  style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any,
                })}
              </View>
            ) : (
              <PressBtn style={qst.datePillWrap} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                <CalendarIcon size={15} color={C.text} />
                <Text style={[qst.datePillText, !date && { color: C.textDim }]}>{date || 'Set date'}</Text>
              </PressBtn>
            )}
          </View>

          {/* Per-person payment */}
          {people.length > 0 && (
            <View>
              <FieldLabel style={{ marginTop: 2 }}>WHO'S PAID</FieldLabel>
              <View style={{ gap: 12 }}>
                {people.map((person, i) => {
                  if (person.id === paidById) return null;
                  const status = statuses.find((s) => s.personId === person.id);
                  const paid = status?.paid ?? false;
                  const amount = amounts.find((a) => a.name === person.name)?.amount ?? 0;
                  return (
                    <PersonPaidRow
                      key={person.id}
                      name={person.name}
                      index={i}
                      paid={paid}
                      amount={amount}
                      onToggle={() => { setPersonPaid(item.id, person.id, !paid, paid ? 0 : amount); flash(); }}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Saved flash */}
          <View style={qst.savedRow}>
            {savedFlash && (
              <>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={qst.savedText}>Saved</Text>
              </>
            )}
          </View>

          {!!DateTimePicker && (
            <DatePickerModal
              visible={showDatePicker}
              value={parsedDate}
              onChange={(d) => commitDate(fmtDate(d))}
              onClose={() => setShowDatePicker(false)}
              title="Set date"
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
      <View style={qst.personRow}>
        <IconBadge size={Badge.avatarSize} bg={paid ? '#E8F5ED' : C.billBg}>
          <BillTypeIcon color={paid ? C.success : C.billFg} size={14} />
        </IconBadge>
        <Text style={[qst.personName, paid && st.closedTitle]} numberOfLines={1}>{label}</Text>
        {paid ? (
          <View style={st.paidAmountRow}>
            <CheckCircleIcon color={C.success} size={13} />
            <Text style={st.paidAmountText}>{fmt(amount)}</Text>
          </View>
        ) : (
          <Text style={qst.personAmt}>{fmt(amount)}</Text>
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
      <Pressable style={qst.backdrop} onPress={onClose}>
        <Pressable style={qst.card} onPress={() => {}}>
          <View style={qst.topRow}>
            <EditableTitle value={name} onChangeText={commitName} placeholder="Trip name" fallback="Trip" />
            <CircleIconButton variant="close" size={20} color={C.text} onPress={onClose} />
          </View>

          <View>
            <FieldLabel>DATES</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {Platform.OS === 'web' ? (
                <View style={[qst.datePillWrap, { flex: 1, position: 'relative' }]}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[qst.datePillText, !live.startDate && { color: C.textDim }]}>{live.startDate || 'Start date'}</Text>
                  {createElement('input', { type: 'date', value: toInputDate(live.startDate), onChange: (e: any) => commitStartDate(fromInputDate(e.target.value)), style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any })}
                </View>
              ) : (
                <PressBtn style={[qst.datePillWrap, { flex: 1 }]} onPress={() => setShowStartPicker(true)} activeOpacity={0.8}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[qst.datePillText, !live.startDate && { color: C.textDim }]}>{live.startDate || 'Start date'}</Text>
                </PressBtn>
              )}
              <View style={{ transform: [{ rotate: '90deg' }] }}>
                <SortIcon size={13} color={C.textDim} />
              </View>
              {Platform.OS === 'web' ? (
                <View style={[qst.datePillWrap, { flex: 1, position: 'relative' }]}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[qst.datePillText, !live.endDate && { color: C.textDim }]}>{live.endDate || 'End date'}</Text>
                  {createElement('input', { type: 'date', value: toInputDate(live.endDate ?? ''), onChange: (e: any) => commitEndDate(fromInputDate(e.target.value)), style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any })}
                </View>
              ) : (
                <PressBtn style={[qst.datePillWrap, { flex: 1 }]} onPress={() => setShowEndPicker(true)} activeOpacity={0.8}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[qst.datePillText, !live.endDate && { color: C.textDim }]}>{live.endDate || 'End date'}</Text>
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

          <View style={qst.savedRow}>
            {savedFlash && (
              <>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={qst.savedText}>Saved</Text>
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

function FeedTypeIcon({ type, color }: { type: 'bill' | 'trip' | 'home'; color: string }) {
  if (type === 'bill') return <BillTypeIcon color={color} size={16} />;
  if (type === 'trip') return <TripTypeIcon color={color} size={16} />;
  return <HomeTypeIcon color={color} size={16} />;
}

function isManualExpense(r: SplitRecord): boolean {
  if (r.source === 'manual') return true;
  if (r.source === 'scan') return false;
  return !!r.tripId && !r.imageUri && (r.items?.length ?? 0) <= 1;
}

type Filter = 'all' | 'bills' | 'trips' | 'homes';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all',   label: 'All' },
  { id: 'bills', label: 'Bills' },
  { id: 'trips', label: 'Trips' },
  { id: 'homes', label: 'Homes' },
];

function displayDate(tab: SplitRecord): string {
  if (tab.receiptDate) return tab.receiptDate;
  return fmtDate(tab.date);
}


// -- Tab (bill) feed item ------------------------------------------------------

function TabFeedItem({ item, onDeleteRequest, onMarkPaid, onReopen, onEdit, onQuickEdit, isClosed }: {
  item: SplitRecord;
  onDeleteRequest: () => void;
  onMarkPaid: () => void;
  onReopen?: () => void;
  onEdit: () => void;
  onQuickEdit: () => void;
  isClosed?: boolean;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const title = item.restaurantName || 'Receipt';
  const subtitle = displayDate(item);
  const people = item.fullPeople ?? [];
  const statuses = item.paymentStatuses ?? [];
  const paidById = item.paidById;
  const nonPayerStatuses = paidById ? statuses.filter((s) => s.personId !== paidById) : statuses;
  const paidCount = nonPayerStatuses.filter((s) => s.paid).length;
  const totalCount = paidById ? people.filter((p) => p.id !== paidById).length : people.length;

  return (
    <Swipeable ref={swipeRef} overshootLeft={false} overshootRight={false}
      renderRightActions={(p) => (
        <View style={{ flexDirection: 'row' }}>
          {isClosed ? (
            <ActionPill progress={p} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.pillInfo}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onReopen?.(); }} />
          ) : (
            <ActionPill progress={p} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.pillPaid}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onMarkPaid(); }} />
          )}
          <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onDeleteRequest(); }} />
        </View>
      )}
    >
      <Card
        style={isClosed && st.feedCardClosed}
        onPress={() => onEdit()}
        onLongPress={() => { lightHaptic(); onQuickEdit(); }}
        pressBorderColor={C.billBg}
      >
        <IconBadge bg={C.billBg}>
          <FeedTypeIcon type="bill" color={C.billFg} />
        </IconBadge>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={st.titleRow}>
            <Text style={[st.feedTitle, isClosed && st.closedTitle, { flex: 1 }]} numberOfLines={1}>{title}</Text>
            {isClosed ? (
              <View style={st.paidAmountRow}>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={st.paidAmountText}>{fmt(item.total)}</Text>
              </View>
            ) : (
              <Text style={st.feedTotal}>{fmt(item.total)}</Text>
            )}
          </View>
          {!!subtitle && <Text style={st.feedDesc} numberOfLines={1}>{subtitle}</Text>}
          {!isClosed && totalCount > 0 && (
            <View style={st.payLine}>
              {paidCount === totalCount ? (
                <CheckCircleIcon size={12} color={C.success} />
              ) : paidCount > 0 ? (
                <ProgressIcon color={C.textDim} size={12} />
              ) : (
                <CircleIcon color={C.textDim} size={12} />
              )}
              <Text style={[st.payLineText, paidCount === totalCount && { color: C.success }]}>
                {paidCount === totalCount ? 'All paid' : `${paidCount} of ${totalCount} paid`}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Swipeable>
  );
}

// -- Trip feed item ------------------------------------------------------------

function TripFeedItem({ trip, onDeleteRequest, onMarkPaid, onReopen, onQuickEdit, isClosed }: {
  trip: Trip;
  onDeleteRequest: () => void;
  onMarkPaid: () => void;
  onReopen?: () => void;
  onQuickEdit: () => void;
  isClosed?: boolean;
}) {
  const router = useRouter();
  const { history } = useSplitStore();
  const swipeRef = useRef<Swipeable>(null);
  const tabs = history.filter((r) => r.tripId === trip.id);
  const closedTabs = tabs.filter((t) => t.status === 'closed').length;
  const total = tabs.reduce((s, r) => s + r.total, 0);
  return (
    <Swipeable ref={swipeRef} overshootLeft={false} overshootRight={false}
      renderRightActions={(p) => (
        <View style={{ flexDirection: 'row' }}>
          {isClosed ? (
            <ActionPill progress={p} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.pillInfo}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onReopen?.(); }} />
          ) : (
            <ActionPill progress={p} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.pillPaid}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onMarkPaid(); }} />
          )}
          <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onDeleteRequest(); }} />
        </View>
      )}
    >
      <Card
        style={isClosed && st.feedCardClosed}
        onPress={() => { selectionHaptic(); router.push({ pathname: '/trip/[id]', params: { id: trip.id } }); }}
        onLongPress={() => { lightHaptic(); onQuickEdit(); }}
        pressBorderColor={C.tripBg}
      >
        <IconBadge bg={C.tripBg}>
          <FeedTypeIcon type="trip" color={C.tripFg} />
        </IconBadge>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={st.titleRow}>
            <Text style={[st.feedTitle, isClosed && st.closedTitle, { flex: 1 }]} numberOfLines={1}>{trip.name}</Text>
            {isClosed ? (
              <View style={st.paidAmountRow}>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={st.paidAmountText}>{fmt(total)}</Text>
              </View>
            ) : (
              <Text style={st.feedTotal}>{fmt(total)}</Text>
            )}
          </View>
          {!!trip.startDate && <Text style={st.feedDesc} numberOfLines={1}>{trip.startDate}</Text>}
          {!isClosed && tabs.length > 0 && (
            <View style={st.payLine}>
              {closedTabs === tabs.length ? (
                <CheckCircleIcon size={12} color={C.success} />
              ) : closedTabs > 0 ? (
                <ProgressIcon color={C.textDim} size={12} />
              ) : (
                <CircleIcon color={C.textDim} size={12} />
              )}
              <Text style={[st.payLineText, closedTabs === tabs.length && { color: C.success }]}>
                {closedTabs === tabs.length ? 'All expenses paid' : `${closedTabs} of ${tabs.length} expenses paid`}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Swipeable>
  );
}

// -- Home feed item ------------------------------------------------------------

type HomeItem = ReturnType<typeof useSplitStore>['homes'][number];

function HomeFeedItem({ home, onDeleteRequest, onMarkPaid, onReopen, isClosed }: {
  home: HomeItem;
  onDeleteRequest: () => void;
  onMarkPaid: () => void;
  onReopen?: () => void;
  isClosed?: boolean;
}) {
  const router = useRouter();
  const { history } = useSplitStore();
  const swipeRef = useRef<Swipeable>(null);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTotal = history
    .filter((r) => {
      if (r.homeId !== home.id) return false;
      const d = new Date(r.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === monthKey;
    })
    .reduce((s, r) => s + r.total, 0);

  return (
    <Swipeable ref={swipeRef} overshootLeft={false} overshootRight={false}
      renderRightActions={(p) => (
        <View style={{ flexDirection: 'row' }}>
          {isClosed ? (
            <ActionPill progress={p} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.pillInfo}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onReopen?.(); }} />
          ) : (
            <ActionPill progress={p} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.pillPaid}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onMarkPaid(); }} />
          )}
          <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onDeleteRequest(); }} />
        </View>
      )}
    >
      <Card
        style={isClosed && st.feedCardClosed}
        onPress={() => { selectionHaptic(); router.push({ pathname: '/home/[id]', params: { id: home.id } } as any); }}
        pressBorderColor={C.homeBg}
      >
        <IconBadge bg={C.homeBg}>
          <FeedTypeIcon type="home" color={C.homeFg} />
        </IconBadge>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={st.titleRow}>
            <Text style={[st.feedTitle, isClosed && st.closedTitle, { flex: 1 }]} numberOfLines={1}>{home.name}</Text>
            {isClosed ? (
              <View style={st.paidAmountRow}>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={st.paidAmountText}>{fmt(monthTotal)}</Text>
              </View>
            ) : (
              <Text style={st.feedTotal}>{fmt(monthTotal)}</Text>
            )}
          </View>
          <Text style={st.feedDesc} numberOfLines={1}>
            {home.members.length > 0 ? home.members.slice(0, 3).join(', ') : 'No members'}
          </Text>
        </View>
      </Card>
    </Swipeable>
  );
}

// -- Main screen ---------------------------------------------------------------

type ConfirmPayload = { id: string; kind: 'tab' | 'trip' | 'home' } | null;

export default function FeedScreen() {
  const router = useRouter();
  const {
    history, deleteHistory, deleteTrip, deleteHome,
    closeTab, reopenTab, closeTrip, reopenTrip, closeHome, reopenHome,
    loadSplit, trips, homes,
  } = useSplitStore();
  const [confirmDelete, setConfirmDelete] = useState<ConfirmPayload>(null);
  const [confirmPaid, setConfirmPaid] = useState<ConfirmPayload>(null);
  const [confirmReopen, setConfirmReopen] = useState<ConfirmPayload>(null);
  const [quickEdit, setQuickEdit] = useState<SplitRecord | null>(null);
  const [quickEditTrip, setQuickEditTrip] = useState<Trip | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  const handleEditTab = (item: SplitRecord) => {
    if (!item.items || !item.fullPeople) return;
    mediumHaptic(); loadSplit(item, true); router.push('/summary');
  };

  const openTabs = useMemo(() =>
    history
      .filter((r) => !r.tripId && !r.homeId && r.status !== 'closed')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history],
  );

  const openTrips = useMemo(() =>
    trips
      .filter((t) => t.status !== 'closed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [trips],
  );

  const openHomes = useMemo(() =>
    homes.filter((h) => h.status !== 'closed'),
    [homes],
  );

  const closedItems = useMemo(() => {
    const closedTabs = history
      .filter((r) => !r.tripId && !r.homeId && r.status === 'closed')
      .map(r => ({ kind: 'tab' as const, date: r.date, item: r }));
    const closedTrips = trips
      .filter((t) => t.status === 'closed')
      .map(t => ({ kind: 'trip' as const, date: t.createdAt, item: t }));
    const closedHomes = homes
      .filter((h) => h.status === 'closed')
      .map(h => ({ kind: 'home' as const, date: h.createdAt, item: h }));
    return [...closedTabs, ...closedTrips, ...closedHomes]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [history, trips, homes]);

  const q = searchQuery.toLowerCase().trim();

  const filteredTabs = useMemo(() => {
    if (activeFilter === 'trips' || activeFilter === 'homes') return [];
    if (!q) return openTabs;
    return openTabs.filter((r) =>
      (r.restaurantName || '').toLowerCase().includes(q) ||
      r.people.some((p) => p.toLowerCase().includes(q))
    );
  }, [openTabs, q, activeFilter]);

  const filteredTrips = useMemo(() => {
    if (activeFilter === 'bills' || activeFilter === 'homes') return [];
    if (!q) return openTrips;
    return openTrips.filter((t) => t.name.toLowerCase().includes(q));
  }, [openTrips, q, activeFilter]);

  const filteredHomes = useMemo(() => {
    if (activeFilter === 'bills' || activeFilter === 'trips') return [];
    if (!q) return openHomes;
    return openHomes.filter((h) =>
      h.name.toLowerCase().includes(q) ||
      h.members.some((m) => m.toLowerCase().includes(q))
    );
  }, [openHomes, q, activeFilter]);

  // Unified "open" list — bills, trips, and homes are all just "unpaid/active" here, so they
  // share one chronological list sectioned by month, instead of being split into separate
  // type-based blocks (which made recency misleading: a stale trip could sit above a
  // this-month bill just because trips rendered first, regardless of date).
  const groupedOpenItems = useMemo(() => {
    const dateOf = (e: { kind: 'tab' | 'trip' | 'home'; item: any }) => {
      if (e.kind === 'tab') return e.item.receiptDate || e.item.date || '';
      if (e.kind === 'trip') return e.item.startDate || e.item.createdAt || '';
      return e.item.createdAt || '';
    };
    const entries = [
      ...filteredTabs.map((item) => ({ kind: 'tab' as const, item })),
      ...filteredTrips.map((item) => ({ kind: 'trip' as const, item })),
      ...filteredHomes.map((item) => ({ kind: 'home' as const, item })),
    ];
    if (entries.length === 0) return [];
    const map = new Map<string, typeof entries>();
    for (const e of entries) {
      const d = parseLocalDate(dateOf(e));
      const key = !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        iso: key,
        label: key === 'unknown' ? '' : fmtMonthYear(`${key}-01`),
        items: items.sort((a, b) => parseLocalDate(dateOf(b)).getTime() - parseLocalDate(dateOf(a)).getTime()),
      }));
  }, [filteredTabs, filteredTrips, filteredHomes]);

  const hasActive = filteredTabs.length > 0 || filteredTrips.length > 0 || filteredHomes.length > 0;
  const hasAnything = openTabs.length > 0 || openTrips.length > 0 || openHomes.length > 0 || closedItems.length > 0;
  const isSearching = q.length > 0;

  const doPaid = () => {
    if (!confirmPaid) return;
    if (confirmPaid.kind === 'tab') closeTab(confirmPaid.id);
    else if (confirmPaid.kind === 'trip') closeTrip(confirmPaid.id);
    else closeHome(confirmPaid.id);
    setConfirmPaid(null);
  };

  const doReopen = () => {
    if (!confirmReopen) return;
    if (confirmReopen.kind === 'tab') reopenTab(confirmReopen.id);
    else if (confirmReopen.kind === 'trip') reopenTrip(confirmReopen.id);
    else reopenHome(confirmReopen.id);
    setConfirmReopen(null);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>

      {/* Fixed header */}
      <View style={st.header}>
        <View style={st.headerRow}>
          <Text style={st.headerTitle}>Open tab</Text>
          <Button variant="secondary" size="small" icon={<PlusIcon color={C.text} size={14} />} label="Join tab" />
        </View>
      </View>
      <View style={st.searchRow}>
        <View style={st.searchBox}>
          <SearchIcon color={C.text} size={16} style={{ marginLeft: 14 }} />
          <TextInput
            style={st.searchInput}
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

      {/* Filter pills */}
      <View style={st.filterRow}>
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            variant="filter"
            size="small"
            active={activeFilter === f.id}
            label={f.label}
            onPress={() => { selectionHaptic(); setActiveFilter(f.id); }}
          />
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Open section */}
        {hasAnything && (
          <View style={st.section}>
            <SectionLabel style={{ marginBottom: 10 }}>OPEN</SectionLabel>
            <View style={st.feedList}>
              {groupedOpenItems.map(({ iso, label, items }) => (
                <View key={iso} style={{ gap: 8 }}>
                  {!!label && <Text style={st.dateGroupLabel}>{label}</Text>}
                  {items.map((e) => {
                    if (e.kind === 'trip') return (
                      <TripFeedItem key={e.item.id} trip={e.item}
                        onDeleteRequest={() => setConfirmDelete({ id: e.item.id, kind: 'trip' })}
                        onMarkPaid={() => setConfirmPaid({ id: e.item.id, kind: 'trip' })}
                        onQuickEdit={() => setQuickEditTrip(e.item)} />
                    );
                    if (e.kind === 'home') return (
                      <HomeFeedItem key={e.item.id} home={e.item}
                        onDeleteRequest={() => setConfirmDelete({ id: e.item.id, kind: 'home' })}
                        onMarkPaid={() => setConfirmPaid({ id: e.item.id, kind: 'home' })} />
                    );
                    return (
                      <TabFeedItem key={e.item.id} item={e.item}
                        onDeleteRequest={() => setConfirmDelete({ id: e.item.id, kind: 'tab' })}
                        onMarkPaid={() => setConfirmPaid({ id: e.item.id, kind: 'tab' })}
                        onEdit={() => handleEditTab(e.item)}
                        onQuickEdit={() => setQuickEdit(e.item)} />
                    );
                  })}
                </View>
              ))}
              {!hasActive && (
                <Text style={st.noResults}>
                  {isSearching ? `No results for "${searchQuery}"` : `No ${activeFilter === 'all' ? 'active items' : activeFilter} yet`}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Closed section */}
        {closedItems.length > 0 && !isSearching && activeFilter === 'all' && (
          <View style={st.section}>
            <SectionLabel style={{ marginBottom: 10 }}>PAID</SectionLabel>
            <View style={st.feedList}>
              {closedItems.map((entry) => {
                if (entry.kind === 'tab') return (
                  <TabFeedItem key={`ctab-${entry.item.id}`} item={entry.item as SplitRecord} isClosed
                    onDeleteRequest={() => setConfirmDelete({ id: entry.item.id, kind: 'tab' })}
                    onMarkPaid={() => {}}
                    onReopen={() => setConfirmReopen({ id: entry.item.id, kind: 'tab' })}
                    onEdit={() => handleEditTab(entry.item as SplitRecord)}
                    onQuickEdit={() => setQuickEdit(entry.item as SplitRecord)} />
                );
                if (entry.kind === 'trip') return (
                  <TripFeedItem key={`ctrip-${entry.item.id}`} trip={entry.item as Trip} isClosed
                    onDeleteRequest={() => setConfirmDelete({ id: entry.item.id, kind: 'trip' })}
                    onMarkPaid={() => {}}
                    onReopen={() => setConfirmReopen({ id: entry.item.id, kind: 'trip' })}
                    onQuickEdit={() => setQuickEditTrip(entry.item as Trip)} />
                );
                return (
                  <HomeFeedItem key={`chome-${entry.item.id}`} home={entry.item as HomeItem} isClosed
                    onDeleteRequest={() => setConfirmDelete({ id: entry.item.id, kind: 'home' })}
                    onMarkPaid={() => {}}
                    onReopen={() => setConfirmReopen({ id: entry.item.id, kind: 'home' })} />
                );
              })}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!hasAnything && (
          <View style={st.empty}>
            <Text style={{ fontSize: 52 }}>??</Text>
            <Text style={st.emptyTitle}>Nothing here yet</Text>
            <Text style={st.emptyText}>Tap + to split a bill, start a trip, or set up a home</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Delete confirmation */}
      <ConfirmModal
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.kind === 'home' ? 'home' : confirmDelete?.kind === 'trip' ? 'trip' : 'bill'}?`}
        body={
          confirmDelete?.kind === 'home'
            ? 'This will remove the home and all its expenses.'
            : confirmDelete?.kind === 'trip'
            ? 'This will remove the trip and all its tabs.'
            : 'This will remove the tab from your history.'
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.kind === 'tab') deleteHistory(confirmDelete.id);
          else if (confirmDelete.kind === 'trip') deleteTrip(confirmDelete.id);
          else deleteHome(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />

      {/* Mark as Paid confirmation */}
      <ConfirmModal
        visible={!!confirmPaid}
        onClose={() => setConfirmPaid(null)}
        title="Mark as paid?"
        body={
          confirmPaid?.kind === 'home'
            ? 'This will mark the home as paid and move it to Paid.'
            : confirmPaid?.kind === 'trip'
            ? 'This will mark the trip as paid and move it to Paid.'
            : 'This will mark the tab as paid. You can still view it there.'
        }
        confirmLabel="Mark Paid"
        confirmIcon={<CheckCircleIcon color={C.text} size={16} />}
        onConfirm={doPaid}
      />

      {/* Reopen confirmation */}
      <ConfirmModal
        visible={!!confirmReopen}
        onClose={() => setConfirmReopen(null)}
        title="Reopen?"
        body="This will move it back to your open tabs so you can continue tracking."
        confirmLabel="Reopen"
        confirmIcon={<ReopenIcon size={16} color={C.text} />}
        onConfirm={doReopen}
      />

      {quickEdit && <QuickEditModal item={quickEdit} onClose={() => setQuickEdit(null)} />}
      {quickEditTrip && <TripQuickModal trip={quickEditTrip} onClose={() => setQuickEditTrip(null)} />}
    </SafeAreaView>
  );
}


const qst = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: C.bg, borderRadius: 20, padding: 20, width: '100%', maxWidth: 420, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, gap: 8 },
  datePillWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primaryDim, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 12,
  },
  datePillText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.text },
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  personName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  personAmt: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 18 },
  savedText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: C.success },
});

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingBottom: 90 },

  header: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'transparent' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: 'Poppins_900Black', fontSize: 30, color: '#000000' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, overflow: 'hidden' },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, height: '100%', textAlignVertical: 'center', paddingHorizontal: 10 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'transparent' },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 32 },

  section: { paddingHorizontal: 16, paddingBottom: 16 },

  dateGroupLabel: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, marginBottom: 6, marginTop: 4 },
  feedList: { gap: 8 },
  feedCardClosed: { opacity: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedTitle: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  closedTitle: { color: C.textDim },
  feedDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -2 },
  feedTotal: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },

  paidAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidAmountText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, textDecorationLine: 'line-through' },

  payLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  payLineText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.textDim },

  noResults: { textAlign: 'center', paddingVertical: 20, fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textDim },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub, textAlign: 'center', paddingHorizontal: 40 },
});
