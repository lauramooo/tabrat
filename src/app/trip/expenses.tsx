import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PressBtn } from '@/components/PressBtn';
import { BillTypeIcon, CalendarIcon, CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, ExpenseIcon, LinkIcon, PlusIcon, ReopenIcon, SortIcon, TrashIcon } from '@/components/FigmaIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS, Alert, Dimensions, FlatList, Platform, Pressable, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { ActionPill } from '@/components/ActionPill';
import { Avatar } from '@/components/Avatar';
import { Button, Card, CenteredModal, CircleIconButton, Dropdown, DropdownRow, EditableTitle, IconBadge } from '@/components/design';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { fmt, getCurrencySymbol, sanitizeNumberInput } from '@/utils/calculator';
import { getCategoryColorMap, getCategoryData } from '@/utils/categoryColors';
import { fmtDate, fmtMonthYear } from '@/utils/date';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import type { SplitRecord } from '@/types';

// ── Date helpers ──────────────────────────────────────────────────────────────

function toISO(d: string): string {
  const m = d.match(/^(\w+)\s+(\d+),\s*(\d+)$/);
  if (!m) return '';
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  return `${m[3]}-${months[m[1]] ?? '01'}-${m[2].padStart(2, '0')}`;
}
function parseDisplay(d: string): Date {
  const iso = toISO(d);
  const dt = iso ? new Date(iso + 'T00:00:00') : new Date(d);
  return isNaN(dt.getTime()) ? new Date() : dt;
}
function getExpenseISODate(r: SplitRecord): string {
  if (r.receiptDate) {
    const iso = toISO(r.receiptDate);
    if (iso) return iso;
  }
  const d = new Date(r.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// ── Swipeable expense row ─────────────────────────────────────────────────────

function ExpenseRow({ tab, catColor, onEdit, onDelete, onLongPress, onOpen }: {
  tab: SplitRecord; catColor?: { bg: string; text: string };
  onEdit: () => void; onDelete: () => void; onLongPress?: () => void; onOpen: (ref: Swipeable) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const isManual = tab.source === 'manual';
  const badgeBg = isManual ? AVATAR_PALETTE[4].bg : C.billBg;
  const badgeFg = isManual ? AVATAR_PALETTE[4].text : C.billFg;
  const renderRightActions = (progress: any) => (
    <ActionPill progress={progress} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
      onPress={() => { swipeRef.current?.close(); onDelete(); }} />
  );
  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false} friction={2} rightThreshold={40}
      onSwipeableOpen={() => { if (swipeRef.current) onOpen(swipeRef.current); }}>
      <Card padding={10} onPress={onEdit} onLongPress={onLongPress} pressBorderColor={badgeBg}>
        <IconBadge size={26} bg={badgeBg}>
          {isManual ? <ExpenseIcon color={badgeFg} size={11} /> : <BillTypeIcon color={badgeFg} size={11} />}
        </IconBadge>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={[s.feedTitle, { flex: 1 }]} numberOfLines={1}>{tab.restaurantName || tab.expenseCategory || 'Expense'}</Text>
            <View style={[s.catBadge, catColor && { backgroundColor: catColor.bg }]}>
              <Text style={[s.catBadgeText, catColor && { color: catColor.text }]}>{tab.expenseCategory || 'Uncategorized'}</Text>
            </View>
            <Text style={s.feedTotal}>{fmt(tab.total, tab.currency ?? 'USD')}</Text>
          </View>
        </View>
      </Card>
    </Swipeable>
  );
}

// ── Quick-edit modal (same as feeds/home) ──────────────────────────────────────

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
        <Avatar name={name} index={index} size={30} />
        <Text style={[qst.personName, paid && qst.personNamePaid]} numberOfLines={1}>{name}</Text>
        {paid ? (
          <View style={qst.paidAmountRow}>
            <CheckCircleIcon color={C.success} size={13} />
            <Text style={qst.paidAmountText}>{fmt(amount)}</Text>
          </View>
        ) : (
          <Text style={qst.personAmt}>{fmt(amount)}</Text>
        )}
      </View>
    </Swipeable>
  );
}

function ExpenseQuickModal({ item, onClose }: { item: SplitRecord; onClose: () => void }) {
  const { updateRecord, setPersonPaid, history } = useSplitStore();
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
    <CenteredModal visible onClose={onClose} title={<EditableTitle value={name} onChangeText={commitName} placeholder="Expense title" fallback="Expense" />}>
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

      {people.length > 0 && (
        <>
          <Text style={qst.sectionLabel}>WHO'S PAID</Text>
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
        </>
      )}

      <View style={qst.savedRow}>
        {savedFlash && (
          <>
            <CheckCircleIcon color={C.success} size={13} />
            <Text style={qst.savedText}>Saved</Text>
          </>
        )}
      </View>

      {showDatePicker && DateTimePicker && (
        <CenteredModal visible onClose={() => setShowDatePicker(false)} padding={16}>
          <DateTimePicker
            value={parsedDate}
            mode="date"
            display="spinner"
            onChange={(_: any, d?: Date) => { if (d) commitDate(fmtDate(d)); setShowDatePicker(false); }}
          />
        </CenteredModal>
      )}
    </CenteredModal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TripExpensesScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const { trips, history, startTripEntry, deleteHistory, saveTripExpenseDirectly } = useSplitStore();

  const [scopePerson, setScopePerson] = useState(''); // '' = everyone, else = person name
  const [scopeDropOpen, setScopeDropOpen] = useState(false);
  const scopeBtnRef = useRef<PressBtn>(null);
  const [scopeDropPos, setScopeDropPos] = useState<{ top: number; right: number } | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [myName, setMyName] = useState('');
  const [quickEditTab, setQuickEditTab] = useState<SplitRecord | null>(null);
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(() => {
    const t = trips.find((tr) => tr.id === tripId);
    if (!t?.startDate) return null;
    const toMidnight = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
    const start = toMidnight(parseDisplay(t.startDate));
    const end = toMidnight(t.endDate ? parseDisplay(t.endDate) : start);
    const today = toMidnight(new Date());
    if (today < start || today > end) return null;
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [quickName, setQuickName] = useState('');
  const [quickAmountText, setQuickAmountText] = useState('');
  const [quickPayer, setQuickPayer] = useState<string | null>(null);
  const [quickPayerDropOpen, setQuickPayerDropOpen] = useState(false);
  const [quickPayerDropPos, setQuickPayerDropPos] = useState<{ bottom: number; right: number } | null>(null);
  const quickPayerBtnRef = useRef<View>(null);
  const [quickNameFocused, setQuickNameFocused] = useState(false);
  const [quickAmountFocused, setQuickAmountFocused] = useState(false);
  const initialSelectedDayRef = useRef(selectedDayISO);
  const dayScrollRef = useRef<FlatList<any>>(null);
  const [dayStripW, setDayStripW] = useState(0);
  const dayStripCenteredRef = useRef(false);
  const activeSwipeable = useRef<Swipeable | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const v = Platform.OS === 'web'
          ? localStorage.getItem('profile_username')
          : await AsyncStorage.getItem('profile_username');
        if (v) setMyName(v);
      } catch {}
    };
    load();
  }, []);

  const trip = trips.find((t) => t.id === tripId);
  const tabs = history
    .filter((r) => r.tripId === tripId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const todayISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Day strip: a full year of padding before/after the trip (or around today, if the trip has
  // no dates) so scrolling never visibly hits an edge — rendered via FlatList below so a
  // ~700-day range stays cheap (only what's on screen + a small buffer actually mounts). Days
  // outside the trip's actual start–end range are flagged via `inTrip: false` so they can be
  // rendered in a distinct, muted color.
  const DAY_STRIP_PADDING = 365;
  const tripDays = useMemo(() => {
    const dayMap: Map<string, { iso: string; dayName: string; dayNum: string }> = new Map();
    const addDay = (iso: string) => {
      if (!dayMap.has(iso)) {
        const dt = new Date(iso + 'T00:00:00');
        dayMap.set(iso, {
          iso,
          dayName: dt.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: String(dt.getDate()),
        });
      }
    };
    let startISO: string | null = null;
    let endISO: string | null = null;
    const start = trip?.startDate ? parseDisplay(trip.startDate) : new Date();
    const end = trip?.startDate ? (trip?.endDate ? parseDisplay(trip.endDate) : start) : start;
    if (trip?.startDate) {
      startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    }
    const padStart = new Date(start); padStart.setDate(padStart.getDate() - DAY_STRIP_PADDING);
    const padEnd = new Date(end); padEnd.setDate(padEnd.getDate() + DAY_STRIP_PADDING);
    const cur = new Date(padStart);
    while (cur <= padEnd && dayMap.size < 900) {
      addDay(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
      cur.setDate(cur.getDate() + 1);
    }
    for (const tab of tabs) addDay(getExpenseISODate(tab));
    const sorted = [...dayMap.values()].sort((a, b) => a.iso.localeCompare(b.iso));
    return sorted.map((day, i) => ({
      ...day,
      inTrip: !startISO || !endISO || (day.iso >= startISO && day.iso <= endISO),
      monthStr: i === 0 || day.iso.substring(0, 7) !== sorted[i - 1].iso.substring(0, 7)
        ? new Date(day.iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })
        : null,
    }));
  }, [trip, tabs]);

  // Center the day strip on today's chip the first time it's laid out (only when today
  // actually fell within the trip's range at mount, per initialSelectedDayRef).
  useEffect(() => {
    if (dayStripCenteredRef.current) return;
    if (!initialSelectedDayRef.current || dayStripW === 0 || tripDays.length === 0) return;
    const idx = tripDays.findIndex((d) => d.iso === initialSelectedDayRef.current);
    if (idx === -1) return;
    const ITEM_W = 38;
    const GAP = 10;
    const itemCenter = idx * (ITEM_W + GAP) + ITEM_W / 2;
    const offset = Math.max(0, itemCenter - dayStripW / 2);
    dayScrollRef.current?.scrollToOffset({ offset, animated: false });
    dayStripCenteredRef.current = true;
  }, [dayStripW, tripDays]);

  // Label above the day strip — defaults to the month containing today (if the trip is
  // currently underway) else the trip's first day, then tracks whatever month is actually
  // scrolled into view once the user starts scrubbing the day strip.
  const defaultMonthKey = useMemo(() => {
    if (tripDays.length === 0) return null;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const months = new Set(tripDays.map((d) => d.iso.slice(0, 7)));
    return months.has(todayKey) ? todayKey : tripDays[0].iso.slice(0, 7);
  }, [tripDays]);
  const [visibleMonthKey, setVisibleMonthKey] = useState<string | null>(null);
  const displayedMonthKey = visibleMonthKey ?? defaultMonthKey;
  const handleDayStripScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (tripDays.length === 0 || dayStripW === 0) return;
    const ITEM_W = 38;
    const GAP = 10;
    const centerX = e.nativeEvent.contentOffset.x + dayStripW / 2;
    const idx = Math.round((centerX - ITEM_W / 2) / (ITEM_W + GAP));
    const day = tripDays[Math.max(0, Math.min(tripDays.length - 1, idx))];
    if (!day) return;
    const key = day.iso.slice(0, 7);
    setVisibleMonthKey((prev) => (prev === key ? prev : key));
  };

  const isInScope = (tab: SplitRecord) =>
    !scopePerson || (tab.personAmounts?.some((p) => p.name === scopePerson && p.amount > 0) ?? false);

  const openScopeDropdown = () => {
    selectionHaptic();
    if (scopeBtnRef.current) {
      scopeBtnRef.current.measureInWindow((_x: number, y: number, w: number, h: number) => {
        setScopeDropPos({ top: y + h + 4, right: 16 });
        setScopeDropOpen(true);
      });
    } else {
      setScopeDropOpen((o) => !o);
    }
  };

  const scopedTabs = useMemo(
    () => tabs.filter((t) => isInScope(t)),
    [tabs, scopePerson],
  );

  const filteredTabs = useMemo(() =>
    selectedDayISO ? scopedTabs.filter((t) => getExpenseISODate(t) === selectedDayISO) : scopedTabs,
    [scopedTabs, selectedDayISO]);

  const groupedTabs = useMemo(() => {
    if (selectedDayISO) return null;
    const now = new Date();
    const nowISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const yesterdayISO = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
    const map = new Map<string, SplitRecord[]>();
    for (const tab of scopedTabs) {
      const iso = getExpenseISODate(tab);
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(tab);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([iso, items]) => ({
        iso,
        label: iso === nowISO ? 'Today' : iso === yesterdayISO ? 'Yesterday' : new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        items,
      }));
  }, [scopedTabs, selectedDayISO]);

  const showExpenseActions = (tab: SplitRecord) => {
    mediumHaptic();
    setQuickEditTab(tab);
  };

  // Category colors — shared with the trip dashboard's donut so chips always match.
  const catData = useMemo(() => getCategoryData(tabs, scopePerson).catData, [tabs, scopePerson]);
  const catColorByLabel = useMemo(() => getCategoryColorMap(catData), [catData]);

  if (!trip) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={s.emptyScreen}><Text style={s.emptyTitle}>Trip not found</Text></View>
      </SafeAreaView>
    );
  }

  const tripPeople = sortWithMeFirst(trip.people ?? [], myName);
  const tripCurrencies = trip.currencies ?? (trip.currency ? [trip.currency] : ['USD']);
  const quickExpenseCurrency = tripCurrencies[0];

  const quickAmount = parseFloat(quickAmountText) || 0;
  const canSaveQuick = quickName.trim().length > 0 && quickAmount > 0 && !!quickPayer;

  const openQuickPayerDropdown = () => {
    selectionHaptic();
    if (quickPayerBtnRef.current) {
      quickPayerBtnRef.current.measureInWindow((_x: number, y: number) => {
        const sh = Dimensions.get('window').height;
        setQuickPayerDropPos({ bottom: sh - y + 4, right: 16 });
        setQuickPayerDropOpen(true);
      });
    } else {
      setQuickPayerDropOpen((o) => !o);
    }
  };

  const handleQuickSave = () => {
    if (!canSaveQuick || !quickPayer) return;
    mediumHaptic();
    saveTripExpenseDirectly({
      name: quickName.trim(),
      receiptDate: fmtDate(new Date()),
      category: null,
      rawItems: [{ name: quickName.trim(), price: quickAmount, quantity: 1 }],
      participants: tripPeople,
      paidByName: quickPayer,
      tripId: tripId!,
      currency: quickExpenseCurrency,
    });
    setQuickName('');
    setQuickAmountText('');
    setQuickPayer(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: `${trip.name} expenses`,
        headerTitleAlign: 'left',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        headerLeft: () => (
          <CircleIconButton variant="back" size={28} color={C.primary} onPress={() => router.back()} style={{ paddingHorizontal: 12 }} />
        ),
      }} />

      {tabs.length > 0 && (
        <View style={s.expHeaderRow}>
          <Text style={s.monthNavLabel}>{displayedMonthKey ? fmtMonthYear(`${displayedMonthKey}-01`) : ''}</Text>
          <PressBtn ref={scopeBtnRef} style={s.scopeDrop} onPress={openScopeDropdown} activeOpacity={0.8}>
            <Text style={s.scopeDropText}>
              {scopePerson ? (scopePerson === myName ? `${scopePerson} (me)` : scopePerson) : 'Everyone'}
            </Text>
            {scopeDropOpen
              ? <ChevronUpCircleIcon color={C.text} size={15} />
              : <ChevronDownCircleIcon color={C.text} size={15} />}
          </PressBtn>
        </View>
      )}
      <Dropdown visible={scopeDropOpen} position={scopeDropPos} onClose={() => setScopeDropOpen(false)} style={{ minWidth: 190 }}>
        {([
          { label: 'Everyone', value: '' },
          ...(myName ? [{ label: `${myName} (me)`, value: myName }] : []),
          ...tripPeople.filter((n) => n !== myName).map((n) => ({ label: n, value: n })),
        ] as { label: string; value: string }[]).map((opt, i) => (
          <DropdownRow
            key={opt.value || '__everyone'}
            onPress={() => { selectionHaptic(); setScopePerson(opt.value); setScopeDropOpen(false); }}
            divider={i > 0}
            trailing={scopePerson === opt.value ? <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" /> : undefined}
          >
            <Text style={[s.scopeDropItemText, scopePerson === opt.value && { color: C.primary }]}>{opt.label}</Text>
          </DropdownRow>
        ))}
      </Dropdown>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.section}>
          {tripDays.length >= 1 && (
            <View style={s.dayPickerRow}>
              <PressBtn style={s.dayStripAllWrap}
                onPress={() => { selectionHaptic(); setSelectedDayISO(null); }} activeOpacity={0.75} noShadow>
                <View style={[s.dayStripAllPill, !selectedDayISO && s.dayStripAllPillActive]}>
                  <Text style={[s.dayStripAll, !selectedDayISO && s.dayStripAllActive]}>All</Text>
                </View>
              </PressBtn>
              <View style={s.dayPickerDivider} />
              <FlatList
                ref={dayScrollRef}
                horizontal
                data={tripDays}
                keyExtractor={(day) => day.iso}
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 10 }}
                onLayout={(e) => setDayStripW(e.nativeEvent.layout.width)}
                onScroll={handleDayStripScroll}
                scrollEventThrottle={100}
                getItemLayout={(_, index) => ({ length: 38, offset: (38 + 10) * index, index })}
                initialNumToRender={30}
                windowSize={11}
                renderItem={({ item: day }) => {
                  const isSelected = selectedDayISO === day.iso;
                  const isToday = day.iso === todayISO;
                  return (
                    <PressBtn style={s.dayBadgeWrap}
                      onPress={() => { selectionHaptic(); setSelectedDayISO(isSelected ? null : day.iso); }} activeOpacity={0.75} noShadow>
                      <Text
                        style={[s.dayBadgeWeekday, !day.inTrip && s.dayBadgeWeekdayOutTrip, isSelected && s.dayBadgeWeekdayActive]}
                        numberOfLines={1}
                      >
                        {isToday ? 'TODAY' : day.dayName.toUpperCase()}
                      </Text>
                      <View style={[s.dayBadgeCircle, isSelected && s.dayBadgeCircleActive]}>
                        <Text style={[s.dayBadgeNum, !day.inTrip && s.dayBadgeNumOutTrip, isSelected && s.dayBadgeNumActive]}>{day.dayNum}</Text>
                      </View>
                      <View style={[s.dayBadgeDot, isToday && s.dayBadgeDotActive]} />
                    </PressBtn>
                  );
                }}
              />
            </View>
          )}

          {filteredTabs.length === 0 ? (
            <View style={s.emptySection}>
              <Text style={s.emptySectionText}>{selectedDayISO ? 'No expenses on this day.' : 'No expenses yet — add the first one below.'}</Text>
            </View>
          ) : groupedTabs ? (
            <View style={{ gap: 24 }}>
              {groupedTabs.map((group) => (
                <View key={group.iso}>
                  <Text style={s.sectionLabel}>{group.label.toUpperCase()}</Text>
                  <View style={{ gap: 8 }}>
                    {group.items.map((tab) => (
                      <ExpenseRow key={tab.id} tab={tab} catColor={catColorByLabel.get(tab.expenseCategory ?? 'Other')}
                        onEdit={() => router.push({ pathname: '/trip/manual-entry' as any, params: { tripId: tripId!, expenseId: tab.id, direct: 'true' } })}
                        onDelete={() => { lightHaptic(); deleteHistory(tab.id); }}
                        onLongPress={() => showExpenseActions(tab)}
                        onOpen={(ref) => { if (activeSwipeable.current && activeSwipeable.current !== ref) activeSwipeable.current.close(); activeSwipeable.current = ref; }} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {filteredTabs.map((tab) => (
                <ExpenseRow key={tab.id} tab={tab} catColor={catColorByLabel.get(tab.expenseCategory ?? 'Other')}
                  onEdit={() => router.push({ pathname: '/trip/manual-entry' as any, params: { tripId: tripId!, expenseId: tab.id, direct: 'true' } })}
                  onDelete={() => { lightHaptic(); deleteHistory(tab.id); }}
                  onLongPress={() => showExpenseActions(tab)}
                  onOpen={(ref) => { if (activeSwipeable.current && activeSwipeable.current !== ref) activeSwipeable.current.close(); activeSwipeable.current = ref; }} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      <>
        <View style={s.quickAddRow}>
          <Card padding={0} row={false} radius={10} style={[s.quickAddNameCard, quickNameFocused && s.quickAddFieldActive]}>
            <TextInput
              style={[s.quickAddNameInput, { outlineWidth: 0 } as any]}
              value={quickName}
              onChangeText={setQuickName}
              onFocus={() => setQuickNameFocused(true)}
              onBlur={() => setQuickNameFocused(false)}
              placeholder="Quick add"
              placeholderTextColor={C.textDim}
              returnKeyType="next"
            />
          </Card>
          <Card padding={0} row={false} radius={10} style={[s.quickAddAmountCard, quickAmountFocused && s.quickAddFieldActive]}>
            <View style={s.quickAddAmountInner}>
              <Text style={s.moneyPrefix}>{getCurrencySymbol(quickExpenseCurrency)}</Text>
              <TextInput
                style={[s.quickAddAmountInput, { outlineWidth: 0 } as any]}
                value={quickAmountText}
                onChangeText={(v) => setQuickAmountText(sanitizeNumberInput(v))}
                onFocus={() => setQuickAmountFocused(true)}
                onBlur={() => setQuickAmountFocused(false)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.textDim}
                returnKeyType="done"
                onSubmitEditing={handleQuickSave}
              />
            </View>
          </Card>
          <PressBtn ref={quickPayerBtnRef} style={[s.quickAddPayerBtn, quickPayerDropOpen && s.quickAddFieldActive]} onPress={openQuickPayerDropdown} noShadow>
            <Text style={[s.quickAddPayerText, !quickPayer && { color: C.textDim }]} numberOfLines={1}>
              {quickPayer ? (quickPayer === myName ? 'Me' : quickPayer) : 'Payer'}
            </Text>
          </PressBtn>
          <PressBtn onPress={handleQuickSave} disabled={!canSaveQuick} hitSlop={8} noShadow>
            <CheckCircleIcon size={17} color={canSaveQuick ? C.text : C.textDim} filled={canSaveQuick} fillColor="#F7D76A" />
          </PressBtn>
          <Dropdown visible={quickPayerDropOpen} position={quickPayerDropPos} onClose={() => setQuickPayerDropOpen(false)} style={{ minWidth: 150 }}>
            {tripPeople.map((name, i) => (
              <DropdownRow
                key={name}
                onPress={() => { selectionHaptic(); setQuickPayer(name); setQuickPayerDropOpen(false); }}
                divider={i > 0}
                trailing={quickPayer === name ? <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" /> : undefined}
              >
                <Text style={s.scopeDropItemText}>{name === myName ? `${name} (me)` : name}</Text>
              </DropdownRow>
            ))}
          </Dropdown>
        </View>
      </>

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Add"
          icon={<PlusIcon color={C.text} size={18} />}
          onPress={() => {
            mediumHaptic();
            if (Platform.OS === 'ios') {
              ActionSheetIOS.showActionSheetWithOptions(
                { options: ['Cancel', 'Expense', 'Bill', 'Link Bill'], cancelButtonIndex: 0 },
                (idx) => {
                  if (idx === 1) { router.push({ pathname: '/trip/manual-entry' as any, params: { tripId: tripId!, direct: 'true' } }); }
                  else if (idx === 2) { startTripEntry(tripId!); router.push('/upload'); }
                  else if (idx === 3) { router.push({ pathname: '/trip/expense' as any, params: { tripId: tripId!, showImport: 'true' } }); }
                },
              );
            } else if (Platform.OS === 'android') {
              Alert.alert('Add', undefined, [
                { text: 'Expense', onPress: () => { router.push({ pathname: '/trip/manual-entry' as any, params: { tripId: tripId!, direct: 'true' } }); } },
                { text: 'Bill', onPress: () => { startTripEntry(tripId!); router.push('/upload'); } },
                { text: 'Link Bill', onPress: () => { router.push({ pathname: '/trip/expense' as any, params: { tripId: tripId!, showImport: 'true' } }); } },
                { text: 'Cancel', style: 'cancel' },
              ]);
            } else {
              setShowAddSheet(true);
            }
          }}
        />
      </View>

      {/* Web add sheet */}
      <CenteredModal visible={showAddSheet} onClose={() => setShowAddSheet(false)} title={<Text style={s.sheetTitle}>Add to trip</Text>}>
        <View style={{ gap: 10 }}>
          {[
            { label: 'Expense', desc: 'Log a single cost without a receipt', badgeBg: AVATAR_PALETTE[4].bg, color: AVATAR_PALETTE[4].text, Icon: ExpenseIcon, onPress: () => { setShowAddSheet(false); router.push({ pathname: '/trip/manual-entry' as any, params: { tripId: tripId!, direct: 'true' } }); } },
            { label: 'Bill', desc: 'Scan or upload a new receipt to split', badgeBg: C.billBg, color: C.billFg, Icon: BillTypeIcon, onPress: () => { setShowAddSheet(false); startTripEntry(tripId!); router.push('/upload'); } },
            { label: 'Link Bill', desc: 'Connect a bill you already split to this trip', badgeBg: AVATAR_PALETTE[3].bg, color: AVATAR_PALETTE[3].text, Icon: LinkIcon, onPress: () => { setShowAddSheet(false); router.push({ pathname: '/trip/expense' as any, params: { tripId: tripId!, showImport: 'true' } }); } },
          ].map((a) => (
            <Card key={a.label} style={s.sheetOption} onPress={a.onPress} pressBorderColor={a.badgeBg}>
              <IconBadge bg={a.badgeBg}>
                <a.Icon color={a.color} size={16} />
              </IconBadge>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetOptionLabel}>{a.label}</Text>
                <Text style={s.sheetOptionDesc}>{a.desc}</Text>
              </View>
            </Card>
          ))}
        </View>
      </CenteredModal>

      {quickEditTab && <ExpenseQuickModal item={quickEditTab} onClose={() => setQuickEditTab(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },
  emptyScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text },

  scopeDrop: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  scopeDropText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.text },
  scopeDropItemText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },

  section: { paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: C.textSub, letterSpacing: 0.8, marginBottom: 10 },

  // Expense cards
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: C.primaryDim },
  catBadgeText: { fontFamily: 'Poppins_500Medium', fontSize: 10, color: C.primary },
  feedTitle: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  feedTotal: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },

  emptySection: { paddingVertical: 20, alignItems: 'center' },
  emptySectionText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textDim },

  // Footer
  footer: { padding: 16, paddingTop: 4 },
  sheetTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text },
  sheetOption: { gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14 },
  sheetOptionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: C.text },
  sheetOptionDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: 2 },

  moneyPrefix: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.textSub },

  // Day strip
  dayPickerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: 12 },
  dayPickerDivider: { width: 1, backgroundColor: C.border, borderRadius: 1 },
  expHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 16, paddingTop: 14 },
  monthNavLabel: { fontFamily: 'Poppins_700Bold', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.text },
  dayStripAllWrap: { alignItems: 'center', justifyContent: 'center' },
  dayStripAllPill: { paddingHorizontal: 10, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  dayStripAllPillActive: { backgroundColor: C.tripBg },
  dayStripAll: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.textSub },
  dayStripAllActive: { color: C.text, fontFamily: 'Poppins_700Bold' },
  dayBadgeWrap: { alignItems: 'center', gap: 1, width: 38 },
  dayBadgeWeekday: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, color: C.textSub, letterSpacing: 0.2 },
  dayBadgeWeekdayActive: { color: C.text },
  dayBadgeWeekdayOutTrip: { color: C.textDim },
  dayBadgeCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  dayBadgeCircleActive: { backgroundColor: C.tripBg },
  dayBadgeDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: 'transparent' },
  dayBadgeDotActive: { backgroundColor: C.text },
  dayBadgeNum: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.text },
  dayBadgeNumActive: { fontFamily: 'Poppins_900Black' },
  dayBadgeNumOutTrip: { color: C.textDim },

  quickAddRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.bg, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  quickAddFieldActive: { borderColor: C.text },
  quickAddNameCard: { flex: 1, height: InputMetrics.height, justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  quickAddNameInput: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.text, paddingHorizontal: 12 },
  quickAddAmountCard: { width: 66, height: InputMetrics.height, justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  quickAddAmountInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 2 },
  quickAddAmountInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.text, padding: 0 },
  quickAddPayerBtn: {
    width: 62, height: InputMetrics.height, alignItems: 'center', justifyContent: 'center',
    borderRadius: InputMetrics.radius, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
  },
  quickAddPayerText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: C.text },
});

const qst = StyleSheet.create({
  datePillWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryDim, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 12 },
  datePillText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.text },
  sectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: C.textSub, letterSpacing: 0.8, marginTop: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.card },
  personName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  personNamePaid: { color: C.textDim },
  personAmt: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  paidAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidAmountText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, textDecorationLine: 'line-through' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 18 },
  savedText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: C.success },
});
