import DateTimePicker from '@react-native-community/datetimepicker';
import { PressBtn } from '@/components/PressBtn';
import { BillTypeIcon, CalendarIcon, CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, CloseCircleIcon, ExpenseIcon, LinkIcon, MoneyIcon, MoreIcon, PencilIcon, PlusCircleIcon, PlusIcon, ReopenIcon, SearchIcon, SortIcon, TrashIcon, UserIcon } from '@/components/FigmaIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActionSheetIOS, Alert, Dimensions, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { G, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar, Text } from 'react-native-paper';
import { Avatar } from '@/components/Avatar';
import { Button, Card, CenteredModal, CircleIconButton, ClosedSettlementRow, ConfirmModal, DatePickerModal, Divider, Dropdown, DropdownRow, EditableTitle, FieldLabel, IconBadge, Input, PayModal, RunningTotalsCard, SettlementRow } from '@/components/design';
import { C } from '@/constants/colors';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { calculateTripSettlement, fmt, getCurrencySymbol, sanitizeNumberInput } from '@/utils/calculator';
import { fmtDate, fmtMonthYear } from '@/utils/date';
import { getCategoryData } from '@/utils/categoryColors';
import { layoutPieSegments, roundedSegmentPath } from '@/utils/pieLayout';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import type { SplitRecord, Person } from '@/types';

function getExpenseISODate(r: SplitRecord): string {
  if (r.receiptDate) {
    const iso = toISO(r.receiptDate);
    if (iso) return iso;
  }
  const d = new Date(r.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SCREEN_H = Dimensions.get('window').height;

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'Fr' },
  { code: 'CNY', symbol: '¥' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'SGD', symbol: 'S$' },
];

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
function fromISO(d: string): string {
  if (!d) return '';
  const [y, mo, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(mo, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
}
function parseDisplay(d: string): Date {
  const iso = toISO(d);
  const dt = iso ? new Date(iso + 'T00:00:00') : new Date(d);
  return isNaN(dt.getTime()) ? new Date() : dt;
}
// ── Pie donut (SVG ring, rounded segment caps) ─────────────────────────────────

const PIE_SIZE = 140;
const PIE_RING = 26;
// Small fixed visual gap between segments — kept deliberately tiny so it can't distort how
// big a segment reads relative to its true share of the total.
const PIE_GAP = 3;
// Just enough length that a near-zero category still renders as a visible hairline rather
// than a literal 0-length (invisible) dash — not a "readable minimum," since inflating tiny
// slices misrepresents how small they actually are. Segments are otherwise sized exactly
// proportional to value/total, which is the whole point of the chart.
const PIE_MIN_SWEEP = 3;
// Slight rounding on each segment's 4 corners — purely cosmetic, computed as an actual small
// corner radius on the segment's own shape rather than a stroke line-cap, so it never eats
// into (or extends past) the segment's true angular sweep the way a "round" cap does.
const PIE_CORNER = 4;

function PieDonut({ data, centerText, currency }: {
  data: { value: number; color: string; textColor: string; label: string }[];
  centerText?: string;
  currency?: string;
}) {
  const [tooltip, setTooltip] = useState<{ label: string; value: number; textColor: string } | null>(null);
  const wasLongPress = useRef(false);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0 || data.length === 0) return null;
  const radius = (PIE_SIZE - PIE_RING) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = PIE_SIZE / 2;
  // Each segment's length comes straight from its true share of the total — PIE_MIN_SWEEP
  // only keeps a near-zero share from disappearing entirely, it doesn't inflate anything
  // already big enough to see. Positions are laid out slot-by-slot (see pieLayout.ts) rather
  // than by raw cumulative value, because several near-zero categories in a row would
  // otherwise all land at virtually the same angle and stack invisibly on top of each other.
  const segments = layoutPieSegments(data, circumference, PIE_GAP, PIE_MIN_SWEEP);
  const paintOrder = [...segments].sort((a, b) => b.len - a.len);
  const outerR = radius + PIE_RING / 2;
  const innerR = radius - PIE_RING / 2;
  return (
    <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
      <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          {paintOrder.map((d) => {
            const startAngle = -d.offset / radius;
            const endAngle = (-d.offset + d.len) / radius;
            return (
              <Path
                key={d.label}
                d={roundedSegmentPath(center, center, innerR, outerR, startAngle, endAngle, PIE_CORNER)}
                fill={d.color}
                onPressIn={() => { wasLongPress.current = false; }}
                onPress={() => {
                  lightHaptic();
                  setTooltip((prev) => (prev?.label === d.label ? null : { label: d.label, value: d.value, textColor: d.textColor }));
                }}
                onLongPress={() => { wasLongPress.current = true; lightHaptic(); setTooltip({ label: d.label, value: d.value, textColor: d.textColor }); }}
                onPressOut={() => { if (wasLongPress.current) { setTooltip(null); wasLongPress.current = false; } }}
              />
            );
          })}
        </G>
      </Svg>
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
      }} pointerEvents="none">
        {tooltip ? (
          <View style={s.pieTooltip}>
            <Text style={[s.pieTooltipAmt, { color: tooltip.textColor }]}>{fmt(tooltip.value, currency)}</Text>
            <Text style={s.pieTooltipLabel} numberOfLines={1}>{tooltip.label}</Text>
          </View>
        ) : centerText ? <Text style={s.pieCenterText}>{centerText}</Text> : null}
      </View>
    </View>
  );
}

// ── Category rename modal ─────────────────────────────────────────────────────

// ── Edit trip modal ───────────────────────────────────────────────────────────

function DatePickerRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [showNative, setShowNative] = useState(false);
  const [iosDate, setIosDate] = useState(new Date());
  const openPicker = () => {
    setIosDate(value ? parseDisplay(value) : new Date());
    setShowNative(true);
  };

  const onNativeChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') { setShowNative(false); if (date) onChange(fmtDate(date)); }
    else if (date) setIosDate(date);
  };

  return (
    <>
      {Platform.OS === 'web' ? (
        <View style={[s.editDateBox, { position: 'relative' }]}>
          <CalendarIcon size={15} color={C.text} />
          <Text style={[s.editDateText, !value && { color: C.textDim }]}>{value || label}</Text>
          {createElement('input', {
            type: 'date',
            value: toISO(value),
            onChange: (e: any) => { const v = e.target.value; if (v) onChange(fromISO(v)); },
            style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any,
          })}
        </View>
      ) : (
        <PressBtn style={s.editDateBox} onPress={openPicker} activeOpacity={0.8}>
          <CalendarIcon size={15} color={C.text} />
          <Text style={[s.editDateText, !value && { color: C.textDim }]}>{value || label}</Text>
          {value ? <PressBtn onPress={() => onChange('')} hitSlop={10}><CloseCircleIcon size={15} color={C.textDim} /></PressBtn> : null}
        </PressBtn>
      )}
      {showNative && Platform.OS === 'android' && <DateTimePicker value={iosDate} mode="date" display="calendar" onChange={onNativeChange} />}
      {Platform.OS === 'ios' && (
        <DatePickerModal
          visible={showNative}
          value={iosDate}
          onChange={(d) => onChange(fmtDate(d))}
          onClose={() => setShowNative(false)}
          title={label}
        />
      )}
    </>
  );
}

function EditTripModal({ visible, trip, myName, onClose, onSave, onLivePreview }: {
  visible: boolean;
  trip: { id: string; name: string; emoji: string; startDate: string; endDate?: string; people?: string[]; currencies?: string[]; currency?: string; budget?: number; groupBudget?: number } | null;
  myName: string;
  onClose: () => void;
  onSave: (data: { name: string; emoji: string; startDate: string; endDate: string; people: string[]; currencies: string[]; budget?: number; groupBudget?: number }) => void;
  /** Lets the screen header (rendered outside this modal) preview name/date edits live, before Save is pressed. Called with null when the modal is closed. */
  onLivePreview?: (preview: { name: string; startDate: string; endDate: string } | null) => void;
}) {
  const [name, setName] = useState('');
  const [titleKey, setTitleKey] = useState(0);
  const [emoji, setEmoji] = useState('✈️');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['USD']);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyDropPos, setCurrencyDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const currencyBtnRef = useRef<View>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendDropOpen, setFriendDropOpen] = useState(false);
  const friendInputRef = useRef<TextInput>(null);
  const [friendsExpanded, setFriendsExpanded] = useState(true);
  const [newCatInput, setNewCatInput] = useState('');
  const [myBudget, setMyBudget] = useState('');
  const [groupBudget, setGroupBudget] = useState('');
  const [focusedMoneyField, setFocusedMoneyField] = useState<string | null>(null);
  const { friends, groups, history, expenseCategories, addExpenseCategory, updateExpenseCategory, removeExpenseCategory } = useSplitStore();
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catValue, setCatValue] = useState('');
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<string | null>(null);
  const [catAddPressed, setCatAddPressed] = useState(false);

  const commitCatEdit = () => {
    const oldCat = editingCat;
    const trimmed = catValue.trim();
    setEditingCat(null);
    if (!oldCat) return;
    if (trimmed && trimmed !== oldCat) updateExpenseCategory(oldCat, trimmed);
  };

  const requestDeleteCategory = (cat: string) => {
    const inUse = trip ? history.some((r) => r.tripId === trip.id && r.expenseCategory === cat) : false;
    if (inUse) { setDeleteCatConfirm(cat); return; }
    lightHaptic();
    removeExpenseCategory(cat);
  };
  const deleteCatCount = deleteCatConfirm && trip
    ? history.filter((r) => r.tripId === trip.id && r.expenseCategory === deleteCatConfirm).length
    : 0;

  useEffect(() => {
    if (trip && visible) {
      setName(trip.name ?? ''); setEmoji(trip.emoji ?? '✈️'); setTitleKey((k) => k + 1);
      setStartDate(trip.startDate ?? ''); setEndDate(trip.endDate ?? '');
      setCurrencies(trip.currencies ?? (trip.currency ? [trip.currency] : ['USD']));
      setCurrencyOpen(false); setFriendSearch(''); setFriendDropOpen(false);
      setFriendsExpanded(true); setEditingCat(null); setNewCatInput('');
      setPeople(sortWithMeFirst(trip.people ?? [], myName));
      setMyBudget(trip.budget ? String(trip.budget) : ''); setGroupBudget(trip.groupBudget ? String(trip.groupBudget) : '');
    } else if (!visible) {
      onLivePreview?.(null);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) onLivePreview?.({ name, startDate, endDate });
  }, [visible, name, startDate, endDate]);

  const addPerson = (n: string) => {
    const t = n.trim(); if (!t || people.includes(t)) return;
    lightHaptic(); setPeople((p) => [...p, t]); setFriendSearch(''); setFriendDropOpen(false);
  };
  const addGroup = (g: { name: string; members: string[] }) => {
    const toAdd = g.members.filter((m) => !people.includes(m));
    if (toAdd.length) { lightHaptic(); setPeople((p) => [...p, ...toAdd]); }
    setFriendSearch(''); setFriendDropOpen(false);
  };

  const toggleCurrency = (code: string) => {
    selectionHaptic();
    setCurrencies((prev) => prev.includes(code) ? (prev.length > 1 ? prev.filter((c) => c !== code) : prev) : [...prev, code]);
  };

  const searchLower = friendSearch.toLowerCase();
  const filteredFriends = friends.filter((f) => !people.includes(f.name) && (!friendSearch || f.name.toLowerCase().includes(searchLower)));
  const filteredGroups = groups.filter((g) => !friendSearch || g.name.toLowerCase().includes(searchLower));
  const showDrop = friendDropOpen && (filteredFriends.length > 0 || filteredGroups.length > 0);

  if (!visible) return null;

  return (
    <>
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={<EditableTitle key={titleKey} value={name} onChangeText={setName} placeholder="Trip name" fallback="Trip" />}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: SCREEN_H * 0.6 }}>
        <FieldLabel>DATES</FieldLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <DatePickerRow label="Start" value={startDate} onChange={setStartDate} />
          <Text style={{ color: C.textDim, fontSize: 15, fontFamily: 'Poppins_500Medium' }}>–</Text>
          <DatePickerRow label="End" value={endDate} onChange={setEndDate} />
        </View>
        <FieldLabel>CURRENCY</FieldLabel>
        <Card padding={0} row={false} radius={10} style={{ marginBottom: 16 }}>
          <PressBtn
            ref={currencyBtnRef}
            style={s.editDateRow}
            onPress={() => {
              selectionHaptic();
              if (currencyBtnRef.current) {
                currencyBtnRef.current.measureInWindow((x, y, w, h) => {
                  setCurrencyDropPos({ top: y + h + 4, left: x, width: w });
                  setCurrencyOpen(true);
                });
              } else {
                setCurrencyOpen((o) => !o);
              }
            }}
            activeOpacity={0.8}
          >
            <MoneyIcon size={15} color={C.primary} />
            <Text style={s.editDateText}>{currencies.join(', ')}</Text>
            {currencyOpen
              ? <ChevronUpCircleIcon color={C.text} size={15} />
              : <ChevronDownCircleIcon color={C.text} size={15} />}
          </PressBtn>
        </Card>
        <Dropdown visible={currencyOpen} position={currencyDropPos} onClose={() => setCurrencyOpen(false)}>
          {CURRENCIES.map((c, i) => {
            const active = currencies.includes(c.code);
            return (
              <DropdownRow
                key={c.code}
                onPress={() => toggleCurrency(c.code)}
                divider={i > 0}
                trailing={active ? <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" /> : undefined}
              >
                <Text style={s.dropdownRowText}>
                  <Text style={{ color: C.text }}>{c.symbol}</Text>
                  <Text style={{ color: C.textSub }}>  {c.code}</Text>
                </Text>
              </DropdownRow>
            );
          })}
        </Dropdown>

        <FieldLabel>MY BUDGET</FieldLabel>
        <Card padding={0} row={false} radius={10} style={[s.moneyCard, focusedMoneyField === 'myBudget' && s.moneyCardFocused]}>
          <View style={[s.editDateRow, { gap: 4 }]}>
            <Text style={s.moneyPrefix}>{getCurrencySymbol(currencies[0] ?? 'USD')}</Text>
            <TextInput
              style={[s.editDateText, { flex: 1, outlineWidth: 0 } as any]}
              value={myBudget}
              onChangeText={(v) => setMyBudget(sanitizeNumberInput(v))}
              keyboardType="decimal-pad"
              placeholder="No limit"
              placeholderTextColor={C.textDim}
              onFocus={() => setFocusedMoneyField('myBudget')}
              onBlur={() => setFocusedMoneyField(null)}
            />
          </View>
        </Card>

        <FieldLabel>GROUP BUDGET</FieldLabel>
        <Card padding={0} row={false} radius={10} style={[s.moneyCard, focusedMoneyField === 'groupBudget' && s.moneyCardFocused]}>
          <View style={[s.editDateRow, { gap: 4 }]}>
            <Text style={s.moneyPrefix}>{getCurrencySymbol(currencies[0] ?? 'USD')}</Text>
            <TextInput
              style={[s.editDateText, { flex: 1, outlineWidth: 0 } as any]}
              value={groupBudget}
              onChangeText={(v) => setGroupBudget(sanitizeNumberInput(v))}
              keyboardType="decimal-pad"
              placeholder="No limit"
              placeholderTextColor={C.textDim}
              onFocus={() => setFocusedMoneyField('groupBudget')}
              onBlur={() => setFocusedMoneyField(null)}
            />
          </View>
        </Card>

        <PressBtn style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }} onPress={() => setFriendsExpanded((o) => !o)} activeOpacity={1} noShadow>
          <FieldLabel>FRIENDS</FieldLabel>
          {friendsExpanded
            ? <ChevronUpCircleIcon color={C.text} size={15} />
            : <ChevronDownCircleIcon color={C.text} size={15} />}
        </PressBtn>
        {friendsExpanded && (
          <>
            {people.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {people.map((pName, i) => {
                  const isMe = pName === myName;
                  return (
                    <PersonChip
                      key={pName}
                      name={isMe ? 'me' : pName}
                      index={i}
                      selected
                      removable
                      onPress={() => { lightHaptic(); setPeople((p) => p.filter((x) => x !== pName)); }}
                    />
                  );
                })}
              </View>
            )}
            <View style={{ position: 'relative', zIndex: showDrop ? 20 : 0, marginBottom: 16 }}>
              <Pressable onPress={() => friendInputRef.current?.focus()}>
                <Card padding={0} row={false} radius={10}>
                  <View style={s.friendAddRow}>
                    <SearchIcon color={C.text} size={15} />
                    <TextInput
                      ref={friendInputRef}
                      style={[s.friendAddInput, { outlineWidth: 0 } as any]}
                      value={friendSearch}
                      onChangeText={setFriendSearch}
                      onFocus={() => setFriendDropOpen(true)}
                      onBlur={() => setTimeout(() => setFriendDropOpen(false), 150)}
                      placeholder="Search friends or groups"
                      placeholderTextColor={C.textDim}
                      onSubmitEditing={() => { addPerson(friendSearch); setFriendSearch(''); setFriendDropOpen(false); }}
                      returnKeyType="done" />
                    {friendSearch.trim() ? (
                      <PressBtn onPress={() => { addPerson(friendSearch); setFriendSearch(''); setFriendDropOpen(false); }} hitSlop={8} activeOpacity={0.7}>
                        <PlusCircleIcon color={C.primary} size={15} />
                      </PressBtn>
                    ) : (
                      <PressBtn onPress={() => setFriendDropOpen((o) => !o)} hitSlop={8} activeOpacity={0.7}>
                        {friendDropOpen
                          ? <ChevronUpCircleIcon color={C.text} size={15} />
                          : <ChevronDownCircleIcon color={C.text} size={15} />}
                      </PressBtn>
                    )}
                  </View>
                </Card>
              </Pressable>
              <Dropdown mode="inline" visible={showDrop} position={{ top: InputMetrics.height + 4 }} onClose={() => setFriendDropOpen(false)}>
                {filteredFriends.map((f) => (
                  <DropdownRow key={f.id} icon={<UserIcon size={15} color={C.textSub} />} onPress={() => { addPerson(f.name); setFriendSearch(''); setFriendDropOpen(false); }}>
                    <Text style={s.friendDropName}>{f.name}</Text>
                  </DropdownRow>
                ))}
                {filteredGroups.map((g) => (
                  <DropdownRow
                    key={g.id}
                    icon={<Text style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{g.icon}</Text>}
                    onPress={() => { addGroup(g); setFriendSearch(''); setFriendDropOpen(false); }}
                  >
                    <Text style={s.friendDropName}>{g.name}</Text>
                    <Text style={s.friendDropSub}>{g.members.length} members</Text>
                  </DropdownRow>
                ))}
              </Dropdown>
            </View>
          </>
        )}
        <FieldLabel style={{ marginBottom: 6 }}>CATEGORIES</FieldLabel>
        <Card padding={0} row={false} radius={10} style={{ marginBottom: 16 }}>
          {expenseCategories.map((cat, i) => {
            const isEditing = editingCat === cat;
            const renameCount = isEditing ? history.filter((r) => r.expenseCategory === cat).length : 0;
            return (
              <View key={cat}>
                {i > 0 && <Divider />}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 8 }}>
                  {isEditing ? (
                    <Input
                      style={[s.editInput, { flex: 1, outlineWidth: 0 } as any]}
                      value={catValue}
                      onChangeText={setCatValue}
                      autoFocus
                      selectTextOnFocus
                      returnKeyType="done"
                      onSubmitEditing={commitCatEdit}
                      onBlur={commitCatEdit}
                    />
                  ) : (
                    <Text style={[s.friendListName, { flex: 1 }]}>{cat}</Text>
                  )}
                  <PressBtn onPress={() => { setCatValue(cat); setEditingCat(cat); }} hitSlop={8}>
                    <PencilIcon color={C.text} size={16} />
                  </PressBtn>
                  <PressBtn onPress={() => requestDeleteCategory(cat)} hitSlop={8}>
                    <CloseCircleIcon color={C.text} size={18} filled fillColor={C.error} />
                  </PressBtn>
                </View>
                {isEditing && renameCount > 0 && (
                  <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, lineHeight: 16, paddingHorizontal: 14, paddingBottom: 10 }}>
                    Editing this category will apply the change to all expenses with this category ({renameCount} expense{renameCount !== 1 ? 's' : ''}).
                  </Text>
                )}
              </View>
            );
          })}
          {expenseCategories.length > 0 && <Divider />}
          <View style={s.friendAddRow}>
            <TextInput
              style={[s.friendAddInput, { outlineWidth: 0 } as any]}
              value={newCatInput}
              onChangeText={setNewCatInput}
              placeholder="Add category…"
              placeholderTextColor={C.textDim}
              onSubmitEditing={() => { const t = newCatInput.trim(); if (t) { addExpenseCategory(t); setNewCatInput(''); } }}
              returnKeyType="done"
            />
            {newCatInput.trim() ? (
              <PressBtn
                onPress={() => { const t = newCatInput.trim(); if (t) { addExpenseCategory(t); setNewCatInput(''); } }}
                onPressIn={() => setCatAddPressed(true)}
                onPressOut={() => setCatAddPressed(false)}
                hitSlop={8}
                noShadow
              >
                <PlusCircleIcon color={C.text} size={15} filled={catAddPressed} />
              </PressBtn>
            ) : null}
          </View>
        </Card>
        <View style={{ height: 4 }} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
        <Button variant="primary" size="small" label="Save"
          onPress={() => {
            if (!name.trim()) return;
            mediumHaptic();
            const myBudgetNum = parseFloat(myBudget);
            const groupBudgetNum = parseFloat(groupBudget);
            onSave({
              name: name.trim(), emoji, startDate, endDate, people, currencies,
              budget: myBudgetNum > 0 ? myBudgetNum : undefined,
              groupBudget: groupBudgetNum > 0 ? groupBudgetNum : undefined,
            });
            onClose();
          }} />
      </View>
    </CenteredModal>
    <ConfirmModal
      visible={!!deleteCatConfirm}
      onClose={() => setDeleteCatConfirm(null)}
      onConfirm={() => {
        if (!deleteCatConfirm) return;
        mediumHaptic();
        removeExpenseCategory(deleteCatConfirm);
        setDeleteCatConfirm(null);
      }}
      title="Delete category?"
      body={`This category is used on ${deleteCatCount} expense${deleteCatCount !== 1 ? 's' : ''} in this trip. Deleting it won't remove those expenses.`}
      confirmLabel="Delete"
      confirmVariant="destructive"
    />
    </>
  );
}

// ── Friends modal ─────────────────────────────────────────────────────────────

function FriendsModal({ visible, people, onClose, onSave }: {
  visible: boolean; people: string[]; onClose: () => void; onSave: (p: string[]) => void;
}) {
  const { friends } = useSplitStore();
  const [local, setLocal] = useState<string[]>(people);
  const [input, setInput] = useState('');
  const available = friends.filter((f) => !local.includes(f.name));
  const addPerson = (name: string) => {
    const t = name.trim(); if (!t || local.includes(t)) return;
    lightHaptic(); setLocal((p) => [...p, t]); setInput('');
  };
  return (
    <CenteredModal visible={visible} onClose={onClose} title={<Text style={[s.modalTitle, { marginBottom: 0 }]}>Friends on this trip</Text>}>
      {available.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {available.map((f) => (
            <PressBtn key={f.id} style={s.friendQuickChip} onPress={() => addPerson(f.name)} activeOpacity={0.7}>
              <Text style={s.friendQuickText}>{f.name}</Text>
              <PlusIcon color={C.primary} size={12} />
            </PressBtn>
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input style={[s.editInput, { flex: 1, outlineWidth: 0 } as any]}
          value={input} onChangeText={setInput} placeholder="Name"
          placeholderTextColor={C.textDim} onSubmitEditing={() => addPerson(input)} returnKeyType="done" />
        <PressBtn style={[s.addPersonBtn, input.trim() && { backgroundColor: C.primary, borderColor: C.primary }]}
          onPress={() => addPerson(input)} disabled={!input.trim()} activeOpacity={0.7}>
          <PlusIcon color={input.trim() ? '#fff' : C.textDim} size={20} />
        </PressBtn>
      </View>
      {local.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {local.map((name, i) => (
            <PersonChip
              key={name}
              name={name}
              index={i}
              selected
              removable
              onPress={() => { lightHaptic(); setLocal((p) => p.filter((x) => x !== name)); }}
            />
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
        <Button variant="primary" size="small" label="Save" onPress={() => { mediumHaptic(); onSave(local); onClose(); }} />
      </View>
    </CenteredModal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { trips, history, tripPayments, updateTrip, deleteTrip, addTripPayment, removeTripPaymentsFor, closeTrip } = useSplitStore();
  const [scopePerson, setScopePerson] = useState(''); // '' = everyone, else = person name
  const [scopeDropOpen, setScopeDropOpen] = useState(false);
  const scopeBtnRef = useRef<PressBtn>(null);
  const [scopeDropPos, setScopeDropPos] = useState<{ top: number; right: number } | null>(null);
  const [friendsModalVisible, setFriendsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editHeaderPreview, setEditHeaderPreview] = useState<{ name: string; startDate: string; endDate: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionsModal, setActionsModal] = useState(false);
  const [payModal, setPayModal] = useState<{ from: string; to: string; amount: number } | null>(null);
  const [reopenConfirm, setReopenConfirm] = useState<{ from: string; to: string } | null>(null);
  const [myName, setMyName] = useState('');
  const [totalsExpanded, setTotalsExpanded] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
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

  const trip = trips.find((t) => t.id === id);
  const tabs = history
    .filter((r) => r.tripId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const myTripPayments = (tripPayments ?? []).filter((p) => p.tripId === id);

  // Build settlement input that includes recorded payments
  const settlementInput = useMemo(() => [
    ...tabs.map((t) => ({ personAmounts: t.personAmounts, paidByName: t.paidByName })),
    ...myTripPayments.map((p) => ({
      paidByName: p.from,
      personAmounts: [{ name: p.to, amount: p.amount }],
    })),
  ], [tabs, myTripPayments]);

  const { personTotals, settlement } = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const tab of tabs) {
      for (const { name, amount } of tab.personAmounts ?? []) {
        totals[name] = (totals[name] ?? 0) + amount;
      }
    }
    const personTotals = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount }));
    return { personTotals, settlement: calculateTripSettlement(settlementInput) };
  }, [tabs, settlementInput]);

  const grandTotal = tabs.reduce((s, t) => s + t.total, 0);

  const visibleSettlement = useMemo(() =>
    scopePerson ? settlement.filter((t) => t.from === scopePerson || t.to === scopePerson) : settlement,
    [settlement, scopePerson],
  );

  // Debts that are fully covered by recorded payments but no longer active in the
  // (payment-netted) `settlement` above — i.e. actually closed, not just reshuffled by
  // the greedy settle-up algorithm. Computed against the payment-less base settlement so a
  // pair's "original amount owed" is stable even as other pairs' netting shifts around it.
  const baseSettlement = useMemo(() => calculateTripSettlement(
    tabs.map((t) => ({ personAmounts: t.personAmounts, paidByName: t.paidByName })),
  ), [tabs]);
  const closedSettlement = useMemo(() => {
    const activeKeys = new Set(settlement.map((t) => `${t.from}→${t.to}`));
    return baseSettlement
      .map((t) => ({
        ...t,
        paid: myTripPayments.filter((p) => p.from === t.from && p.to === t.to).reduce((sum, p) => sum + p.amount, 0),
      }))
      .filter((t) => t.paid >= t.amount - 0.005 && !activeKeys.has(`${t.from}→${t.to}`));
  }, [baseSettlement, settlement, myTripPayments]);
  const visibleClosedSettlement = useMemo(() =>
    scopePerson ? closedSettlement.filter((t) => t.from === scopePerson || t.to === scopePerson) : closedSettlement,
    [closedSettlement, scopePerson],
  );

  // Category breakdown filtered by selected person (or everyone) — shared with the trip
  // expenses page so the donut and the expense-card category chips always agree on colors.
  const { catData, catTotal } = useMemo(() => getCategoryData(tabs, scopePerson), [tabs, scopePerson]);

  const { myBudgetSpent, groupBudgetSpent } = useMemo(() => {
    let mine = 0;
    let group = 0;
    for (const tab of tabs) {
      const pa = tab.personAmounts?.find((p) => p.name === myName);
      mine += pa?.amount ?? 0;
      group += tab.total;
    }
    return { myBudgetSpent: mine, groupBudgetSpent: group };
  }, [tabs, myName]);

  if (!trip) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={s.emptyScreen}><Text style={s.emptyTitle}>Trip not found</Text></View>
      </SafeAreaView>
    );
  }

  const tripPeople = sortWithMeFirst(trip.people ?? [], myName);
  const tripCurrency = trip.currency ?? 'USD';

  const handleSaveFriends = (people: string[]) => {
    if (!trip) return;
    updateTrip(trip.id, trip.name, trip.emoji, trip.startDate, trip.endDate, people, trip.currency, trip.currencies, trip.budget, trip.groupBudget);
  };
  const handleSaveTrip = (data: { name: string; emoji: string; startDate: string; endDate: string; people: string[]; currencies: string[]; budget?: number; groupBudget?: number }) => {
    if (!trip) return;
    updateTrip(trip.id, data.name, data.emoji, data.startDate, data.endDate, data.people, data.currencies[0], data.currencies, data.budget, data.groupBudget);
  };

  const openScopeDropdown = () => {
    selectionHaptic();
    if (scopeBtnRef.current) {
      scopeBtnRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
        const sw = Dimensions.get('window').width;
        setScopeDropPos({ top: y + h + 4, right: sw - x - w });
        setScopeDropOpen(true);
      });
    } else {
      setScopeDropOpen((o) => !o);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        headerTitleAlign: 'center',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        headerTitle: () => {
          const hName = editHeaderPreview?.name || trip.name;
          const hStart = editHeaderPreview ? editHeaderPreview.startDate : trip.startDate;
          const hEnd = editHeaderPreview ? editHeaderPreview.endDate : trip.endDate;
          return (
            <View style={{ alignItems: 'center' }}>
              <Text style={s.hdrTitle}>{hName}</Text>
              {!!(hStart || hEnd) && (
                <Text style={s.hdrDate}>{hStart}{hEnd ? ` – ${hEnd}` : ''}</Text>
              )}
            </View>
          );
        },
        headerLeft: () => (
          <CircleIconButton variant="back" size={28} color={C.primary} onPress={() => router.replace('/(tabs)/trips' as any)} style={{ paddingHorizontal: 12 }} />
        ),
        headerRight: () => (
          <PressBtn onPress={() => setActionsModal(true)} activeOpacity={0.5} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <MoreIcon color={C.text} size={20} />
          </PressBtn>
        ),
      }} />

      {/* ── Friend bubbles strip ── */}
      {tripPeople.length > 0 && (
        <View style={s.friendStrip}>
          {tripPeople.slice(0, 8).map((pName, i) => (
            <Avatar
              key={pName}
              name={pName}
              index={i}
              size={18}
              fontSize={8}
              style={[s.hdrAvatar, { marginLeft: i === 0 ? 0 : -5, zIndex: 10 - i }]}
            />
          ))}
        </View>
      )}

      {/* ── Total + person scope dropdown (fixed, above scroll) ── */}
      <View style={s.totalBar}>
          <View>
            <Text style={s.totalBarLabel}>TOTAL</Text>
            <Text style={s.totalBarAmt}>{getCurrencySymbol(tripCurrency)}{Math.round(catTotal)}</Text>
          </View>
          <PressBtn
            ref={scopeBtnRef}
            style={s.scopeDrop}
            onPress={openScopeDropdown}
            activeOpacity={0.8}
          >
            <Text style={s.scopeDropText}>
              {scopePerson ? (scopePerson === myName ? `${scopePerson} (me)` : scopePerson) : 'Everyone'}
            </Text>
            {scopeDropOpen
              ? <ChevronUpCircleIcon color={C.text} size={15} />
              : <ChevronDownCircleIcon color={C.text} size={15} />}
          </PressBtn>
        </View>
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

        {/* ── Pie chart (dashboard only, scoped by selected person) ── */}
        {tabs.length > 0 && (
          <View style={[s.section, { paddingTop: 4 }]}>
            <View style={s.pieSection}>
              {catData.length === 0 ? (
                <Text style={s.noDataNote}>No expense data for this view.</Text>
              ) : (
                <View style={s.pieRow}>
                  <PieDonut data={catData} centerText={fmt(catTotal, tripCurrency)} currency={tripCurrency} />
                  <View style={s.pieLegend}>
                    {catData.map(({ label, value, color, textColor }) => (
                      <View key={label} style={s.legendRow}>
                        <View style={[s.legendDot, { backgroundColor: color }]} />
                        <Text style={[s.legendAmt, { color: textColor }]} numberOfLines={1}>{fmt(value, tripCurrency)}</Text>
                        <Text style={[s.legendLabel, { color: textColor }]} numberOfLines={1}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Dashboard: Budget progress — "My spending" only when scoped to you, "Group spending" only when scoped to Everyone ── */}
        {(
          (!!trip.budget && scopePerson === myName) || (!!trip.groupBudget && !scopePerson)
        ) && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>BUDGET</Text>
            <View style={{ gap: 14 }}>
              {!!trip.budget && scopePerson === myName && (() => {
                const remaining = trip.budget - myBudgetSpent;
                const over = remaining < 0;
                return (
                  <View style={s.budgetRow}>
                    <Text style={{ alignSelf: 'flex-end' }}>
                      <Text style={[s.budgetAmt, over && { color: C.error }]}>{getCurrencySymbol(tripCurrency)}{Math.round(Math.abs(remaining))}</Text>
                      <Text style={s.budgetSub}> {over ? 'over budget' : 'left to spend'}</Text>
                    </Text>
                    <ProgressBar progress={Math.min(1, myBudgetSpent / trip.budget)} color={over ? C.error : '#F7D76A'} style={s.budgetBar} />
                  </View>
                );
              })()}
              {!!trip.groupBudget && !scopePerson && (() => {
                const remaining = trip.groupBudget - groupBudgetSpent;
                const over = remaining < 0;
                return (
                  <View style={s.budgetRow}>
                    <Text style={{ alignSelf: 'flex-end' }}>
                      <Text style={[s.budgetAmt, over && { color: C.error }]}>{getCurrencySymbol(tripCurrency)}{Math.round(Math.abs(remaining))}</Text>
                      <Text style={s.budgetSub}> {over ? 'over budget' : 'left to spend'}</Text>
                    </Text>
                    <ProgressBar progress={Math.min(1, groupBudgetSpent / trip.groupBudget)} color={over ? C.error : '#F7D76A'} style={s.budgetBar} />
                  </View>
                );
              })()}
            </View>
          </View>
        )}

        {/* ── Dashboard: Who owes who (always, not filtered by person) ── */}
        {visibleSettlement.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>WHO OWES WHO</Text>
            <View style={{ gap: 8 }}>
              {visibleSettlement.map((txn, i) => {
                const fromIdx = tripPeople.indexOf(txn.from);
                const avatarIdx = fromIdx >= 0 ? fromIdx : i;
                const paidSoFar = myTripPayments
                  .filter((p) => p.from === txn.from && p.to === txn.to)
                  .reduce((sum, p) => sum + p.amount, 0);
                return (
                  <SettlementRow
                    key={i}
                    txn={txn}
                    avatarIdx={avatarIdx}
                    scopePerson={scopePerson}
                    myName={myName}
                    currency={tripCurrency}
                    paidSoFar={paidSoFar}
                    onPress={() => { selectionHaptic(); setPayModal({ from: txn.from, to: txn.to, amount: txn.amount }); }}
                    onMarkPaid={() => { selectionHaptic(); addTripPayment(id!, txn.from, txn.to, txn.amount); }}
                    onSwipeOpen={(ref) => {
                      if (activeSwipeable.current && activeSwipeable.current !== ref) activeSwipeable.current.close();
                      activeSwipeable.current = ref;
                    }}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ── Dashboard: Paid / closed debts ── */}
        {visibleClosedSettlement.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>PAID</Text>
            <View style={{ gap: 8 }}>
              {visibleClosedSettlement.map((txn, i) => {
                const fromIdx = tripPeople.indexOf(txn.from);
                const avatarIdx = fromIdx >= 0 ? fromIdx : i;
                return (
                  <ClosedSettlementRow
                    key={i}
                    txn={txn}
                    avatarIdx={avatarIdx}
                    scopePerson={scopePerson}
                    myName={myName}
                    currency={tripCurrency}
                    onReopen={() => { selectionHaptic(); setReopenConfirm({ from: txn.from, to: txn.to }); }}
                    onSwipeOpen={(ref) => {
                      if (activeSwipeable.current && activeSwipeable.current !== ref) activeSwipeable.current.close();
                      activeSwipeable.current = ref;
                    }}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ── Dashboard: Running totals (always, not filtered by person) ── */}
        {personTotals.length > 0 && (
          <View style={s.section}>
            <PressBtn style={s.sectionHeaderRow} onPress={() => { selectionHaptic(); setTotalsExpanded((e) => !e); }} activeOpacity={1} noShadow>
              <Text style={[s.sectionLabel, { marginBottom: 0 }]}>RUNNING TOTALS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PressBtn onPress={(e) => { e.stopPropagation(); selectionHaptic(); setSortDesc((d) => !d); }} hitSlop={8} activeOpacity={1} noShadow>
                  <View style={sortDesc ? { transform: [{ rotate: '180deg' }] } : undefined}>
                    <SortIcon size={12} color={C.textDim} />
                  </View>
                </PressBtn>
                {totalsExpanded
                  ? <ChevronUpCircleIcon color={C.text} size={15} />
                  : <ChevronDownCircleIcon color={C.text} size={15} />}
              </View>
            </PressBtn>
            {totalsExpanded && (
              <RunningTotalsCard
                people={[...personTotals].sort((a, b) => sortDesc ? b.amount - a.amount : a.amount - b.amount)}
                currency={tripCurrency}
              />
            )}
          </View>
        )}

        {tabs.length > 0 && visibleSettlement.length === 0 && personTotals.length > 0 && (
          <Text style={s.noSettlementNote}>Set a payer on each expense to see who owes who.</Text>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Expenses"
          icon={<ExpenseIcon color={C.text} size={18} />}
          onPress={() => { selectionHaptic(); router.push({ pathname: '/trip/expenses' as any, params: { tripId: id! } }); }}
        />
      </View>

      <FriendsModal visible={friendsModalVisible} people={tripPeople}
        onClose={() => setFriendsModalVisible(false)} onSave={handleSaveFriends} />
      <EditTripModal visible={editModalVisible} trip={trip} myName={myName}
        onClose={() => setEditModalVisible(false)} onSave={handleSaveTrip} onLivePreview={setEditHeaderPreview} />
      {payModal && (
        <PayModal
          from={payModal.from} to={payModal.to} maxAmount={payModal.amount} currency={tripCurrency}
          breakdown={tabs
            .filter((t) => t.personAmounts?.some((p) => p.name === payModal.from && p.amount > 0))
            .map((t) => ({ name: t.restaurantName || 'Expense', amount: t.personAmounts?.find((p) => p.name === payModal.from)?.amount ?? 0 }))}
          paymentHistory={tripPayments
            .filter((p) => p.tripId === id && p.from === payModal.from && p.to === payModal.to)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p) => ({ amount: p.amount, date: p.date }))}
          onClose={() => setPayModal(null)}
          onConfirm={(amount) => {
            mediumHaptic();
            addTripPayment(id!, payModal.from, payModal.to, amount);
            setPayModal(null);
          }}
        />
      )}

      {/* ── Actions menu ── */}
      <Modal visible={actionsModal} transparent animationType="fade" onRequestClose={() => setActionsModal(false)}>
        <Pressable style={s.actionsBackdrop} onPress={() => setActionsModal(false)}>
          <View style={s.actionsCard}>
            <PressBtn style={s.actionsRow} onPress={() => { setActionsModal(false); setEditModalVisible(true); }} activeOpacity={0.6}>
              <PencilIcon color={C.textSub} size={17} />
              <Text style={s.actionsRowText}>Edit</Text>
            </PressBtn>
            <PressBtn style={[s.actionsRow, s.actionsRowDivider]} onPress={() => { setActionsModal(false); closeTrip(trip.id); router.back(); }} activeOpacity={0.6}>
              <CheckCircleIcon color={C.textSub} size={17} />
              <Text style={s.actionsRowText}>Close trip</Text>
            </PressBtn>
            <PressBtn style={[s.actionsRow, s.actionsRowDivider]} onPress={() => { setActionsModal(false); setDeleteConfirm(true); }} activeOpacity={0.6}>
              <TrashIcon color={C.error} size={17} />
              <Text style={[s.actionsRowText, { color: C.error }]}>Delete</Text>
            </PressBtn>
          </View>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => {
          mediumHaptic();
          setDeleteConfirm(false);
          deleteTrip(id!);
          router.replace('/(tabs)/trips' as any);
        }}
        title="Delete trip?"
        body={`This will permanently remove "${trip.name}" and all its expenses.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
      />

      <ConfirmModal
        visible={!!reopenConfirm}
        onClose={() => setReopenConfirm(null)}
        onConfirm={() => {
          if (!reopenConfirm) return;
          selectionHaptic();
          removeTripPaymentsFor(id!, reopenConfirm.from, reopenConfirm.to);
          setReopenConfirm(null);
        }}
        title="Reopen?"
        body="This will move it back to who owes who so you can continue tracking."
        confirmLabel="Reopen"
        confirmIcon={<ReopenIcon size={16} color={C.text} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },

  // Nav header
  hdrTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text, letterSpacing: 0.3 },
  hdrDate: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -4 },
  friendStrip: { flexDirection: 'row', justifyContent: 'center', paddingTop: 0, paddingBottom: 4 },
  hdrAvatarRow: { flexDirection: 'row', marginTop: 4 },
  hdrAvatar: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.bg },

  // Total bar + scope dropdown
  totalBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  totalBarLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: C.textSub, letterSpacing: 0.8 },
  totalBarAmt: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text, lineHeight: 30 },
  scopeDrop: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  scopeDropText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.text },
  scopeDropItemText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },

  // Actions dropdown
  actionsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  actionsCard: { position: 'absolute', top: 54, right: 10, backgroundColor: C.bg, borderRadius: 14, width: 210, overflow: 'hidden' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  actionsRowText: { fontFamily: 'Poppins_400Regular', fontSize: 16, color: C.text },
  actionsRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: C.textSub, letterSpacing: 0.8, marginBottom: 10 },
  budgetRow: { gap: 6 },
  budgetAmt: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: C.text },
  budgetSub: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textSub },
  budgetBar: { height: 8, borderRadius: 4, backgroundColor: C.border },

  // Pie
  pieSection: { padding: 12 },
  pieRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  pieLegend: { width: 150, gap: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  legendLabel: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 11, color: C.text },
  legendAmt: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: C.text, width: 62 },
  pieCenterText: { fontFamily: 'Poppins_900Black', fontSize: 12, color: C.text, textAlign: 'center' },
  pieTooltip: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  pieTooltipAmt: { fontFamily: 'Poppins_900Black', fontSize: 13 },
  pieTooltipLabel: { fontFamily: 'Poppins_500Medium', fontSize: 10, color: C.textSub, maxWidth: 80 },
  noDataNote: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textDim, textAlign: 'center', paddingVertical: 16 },

  noSettlementNote: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textDim, textAlign: 'center', marginTop: 12, marginHorizontal: 16, fontStyle: 'italic' },


  emptyScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text },

  // Footer
  footer: { padding: 16, paddingTop: 8 },

  // Modals (shared)
  modalTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: C.text, marginBottom: 16, flexShrink: 1 },

  editInput: { fontFamily: 'Poppins_500Medium', fontSize: 15 },
  editDateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: InputMetrics.height },
  editDateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 14 },
  editDateText: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text },
  moneyPrefix: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.textSub },
  moneyCard: { marginBottom: 16, borderWidth: 1.5, borderColor: 'transparent' },
  moneyCardFocused: { borderColor: C.text },
  dropdownRowText: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },
  friendListName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },
  friendAddRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: InputMetrics.height, gap: 10 },
  friendAddInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },
  friendDropName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  friendDropSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textDim },
  addPersonBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  friendQuickChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card },
  friendQuickText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.textSub },
});

