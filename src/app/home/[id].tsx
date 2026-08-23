import DateTimePicker from '@react-native-community/datetimepicker';
import { PressBtn } from '@/components/PressBtn';
import { CalendarIcon, CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, CloseCircleIcon, ExpenseIcon, MoreIcon, PencilIcon, PlusCircleIcon, ReopenIcon, SortIcon, TrashIcon } from '@/components/FigmaIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { G, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Avatar } from '@/components/Avatar';
import { Button, Card, CenteredModal, CircleIconButton, ClosedSettlementRow, ConfirmModal, DatePickerModal, Divider, Dropdown, DropdownRow, EditableTitle, FieldLabel, Input, PayModal, RunningTotalsCard, SectionLabel, SettlementRow } from '@/components/design';
import { C } from '@/constants/colors';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { calculateTripSettlement, fmt, getCurrencySymbol, sanitizeNumberInput } from '@/utils/calculator';
import { getCategoryData } from '@/utils/categoryColors';
import { fmtDate } from '@/utils/date';
import { mediumHaptic, selectionHaptic, lightHaptic } from '@/utils/haptics';
import { layoutPieSegments, roundedSegmentPath } from '@/utils/pieLayout';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DEFAULT_HOME_CATEGORIES = [
  'Rent', 'Utilities', 'Groceries', 'Internet', 'Cleaning',
  'Repairs', 'Insurance', 'Subscriptions', 'Household', 'Other',
];

function toISO(d: string): string {
  const m = d.match(/^(\w+)\s+(\d+),\s*(\d+)$/);
  if (!m) return '';
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  return `${m[3]}-${months[m[1]] ?? '01'}-${m[2].padStart(2, '0')}`;
}

function getHomeExpenseDate(r: { date: string; receiptDate?: string }): string {
  if (r.receiptDate) {
    const iso = toISO(r.receiptDate);
    if (iso) return iso;
  }
  const d = new Date(r.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(d: string): string {
  if (!d) return '';
  const [y, mo, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(mo, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
}
function parseDateDisplay(d: string): Date {
  const iso = toISO(d);
  const dt = iso ? new Date(iso + 'T00:00:00') : new Date(d);
  return isNaN(dt.getTime()) ? new Date() : dt;
}
function isoToDisplay(isoStr: string): string {
  return isoStr ? fmtDate(isoStr) : '';
}

// ── Pie donut (SVG ring, rounded segment caps; exact copy of trip's PieDonut) ──

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

// Simple settlement: who owes who based on who paid vs equal shares
function computeSettlement(
  expenses: Array<{ paidByName?: string; personAmounts?: Array<{ name: string; amount: number }>; total: number }>,
  members: string[],
) {
  const balance: Record<string, number> = {};
  members.forEach((m) => (balance[m] = 0));

  for (const exp of expenses) {
    const payer = exp.paidByName;
    if (!payer) continue;
    if (!(payer in balance)) balance[payer] = 0;
    // Payer gets credited total
    balance[payer] += exp.total;
    // Each participant owes their share
    if (exp.personAmounts && exp.personAmounts.length > 0) {
      for (const pa of exp.personAmounts) {
        if (!(pa.name in balance)) balance[pa.name] = 0;
        balance[pa.name] -= pa.amount;
      }
    } else {
      const n = members.length || 1;
      for (const m of members) {
        balance[m] -= exp.total / n;
      }
    }
  }

  // Convert balances to debt pairs
  const settlements: Array<{ from: string; to: string; amount: number }> = [];
  const pos = Object.entries(balance).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]);
  const neg = Object.entries(balance).filter(([, v]) => v < -0.005).sort((a, b) => a[1] - b[1]);
  let pi = 0; let ni = 0;
  let posArr = pos.map(([k, v]) => ({ name: k, val: v }));
  let negArr = neg.map(([k, v]) => ({ name: k, val: -v }));
  while (pi < posArr.length && ni < negArr.length) {
    const amount = Math.min(posArr[pi].val, negArr[ni].val);
    if (amount > 0.005) settlements.push({ from: negArr[ni].name, to: posArr[pi].name, amount });
    posArr[pi].val -= amount;
    negArr[ni].val -= amount;
    if (posArr[pi].val < 0.005) pi++;
    if (negArr[ni].val < 0.005) ni++;
  }
  return settlements;
}

function HomeDatePickerRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [showNative, setShowNative] = useState(false);
  const [iosDate, setIosDate] = useState(new Date());
  const openPicker = () => { setIosDate(value ? parseDateDisplay(value) : new Date()); setShowNative(true); };
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

function EditHomeModal({
  home,
  onClose,
  onSave,
}: {
  home: { id: string; name: string; emoji: string; members: string[]; createdAt: string; endDate?: string };
  onClose: () => void;
  onSave: (name: string, emoji: string, members: string[], startDate: string, endDate: string) => void;
}) {
  const { history, homeExpenseCategories, addHomeExpenseCategory, updateHomeExpenseCategory, removeHomeExpenseCategory } = useSplitStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catValue, setCatValue] = useState('');
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<string | null>(null);
  const [catAddPressed, setCatAddPressed] = useState(false);

  useEffect(() => {
    setName(home.name ?? '');
    setEmoji(home.emoji ?? '🏠');
    setMembers([...home.members]);
    setNewMember('');
    setStartDate(isoToDisplay(home.createdAt));
    setEndDate(home.endDate ? isoToDisplay(home.endDate) : '');
    setNewCatInput(''); setEditingCat(null);
  }, []);

  const addMember = () => {
    const t = newMember.trim();
    if (t && !members.includes(t)) { lightHaptic(); setMembers((p) => [...p, t]); }
    setNewMember('');
  };

  const commitCatEdit = () => {
    const oldCat = editingCat;
    const trimmed = catValue.trim();
    setEditingCat(null);
    if (!oldCat) return;
    if (trimmed && trimmed !== oldCat) updateHomeExpenseCategory(oldCat, trimmed);
  };

  const requestDeleteCategory = (cat: string) => {
    const inUse = history.some((r) => r.homeId === home.id && r.expenseCategory === cat);
    if (inUse) { setDeleteCatConfirm(cat); return; }
    lightHaptic();
    removeHomeExpenseCategory(cat);
  };
  const deleteCatCount = deleteCatConfirm
    ? history.filter((r) => r.homeId === home.id && r.expenseCategory === deleteCatConfirm).length
    : 0;

  return (
    <>
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
            <EditableTitle value={name} onChangeText={setName} placeholder="Home name" fallback="Home" />
            <CircleIconButton variant="close" size={20} color={C.text} onPress={onClose} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <FieldLabel style={{ marginBottom: 6 }}>DATES</FieldLabel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <HomeDatePickerRow label="Start" value={startDate} onChange={setStartDate} />
              <Text style={{ color: C.textDim, fontSize: 15, fontFamily: 'Poppins_500Medium' }}>–</Text>
              <HomeDatePickerRow label="End" value={endDate} onChange={setEndDate} />
            </View>

            <FieldLabel style={{ marginBottom: 6 }}>MEMBERS</FieldLabel>
            {members.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {members.map((m, i) => (
                  <PersonChip
                    key={m}
                    name={m}
                    index={i}
                    selected
                    removable
                    onPress={() => { lightHaptic(); setMembers((p) => p.filter((x) => x !== m)); }}
                  />
                ))}
              </View>
            )}
            <Card row={false} padding={0} radius={10} style={{ overflow: 'hidden', marginBottom: 16 }}>
              <View style={s.friendAddRow}>
                <TextInput
                  style={[s.friendAddInput, { outlineWidth: 0 } as any]}
                  value={newMember} onChangeText={setNewMember}
                  placeholder="Add a member" placeholderTextColor={C.textDim}
                  onSubmitEditing={addMember} returnKeyType="done"
                />
                {newMember.trim() ? (
                  <PressBtn onPress={addMember} hitSlop={8} activeOpacity={0.7}>
                    <PlusCircleIcon color={C.primary} size={15} />
                  </PressBtn>
                ) : null}
              </View>
            </Card>

            <FieldLabel style={{ marginBottom: 6 }}>CATEGORIES</FieldLabel>
            <Card row={false} padding={0} radius={10} style={{ marginBottom: 16 }}>
              {homeExpenseCategories.map((cat, i) => {
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
              {homeExpenseCategories.length > 0 && <Divider />}
              <View style={s.friendAddRow}>
                <TextInput
                  style={[s.friendAddInput, { outlineWidth: 0 } as any]}
                  value={newCatInput} onChangeText={setNewCatInput}
                  placeholder="Add category…" placeholderTextColor={C.textDim}
                  onSubmitEditing={() => { const t = newCatInput.trim(); if (t) { addHomeExpenseCategory(t); setNewCatInput(''); } }}
                  returnKeyType="done"
                />
                {newCatInput.trim() ? (
                  <PressBtn
                    onPress={() => { const t = newCatInput.trim(); if (t) { addHomeExpenseCategory(t); setNewCatInput(''); } }}
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
          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
            <Button variant="primary" size="small" label="Save"
              onPress={() => { if (!name.trim()) return; mediumHaptic(); onSave(name.trim(), emoji, members, toISO(startDate), endDate ? toISO(endDate) : ''); onClose(); }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    <ConfirmModal
      visible={!!deleteCatConfirm}
      onClose={() => setDeleteCatConfirm(null)}
      onConfirm={() => {
        if (!deleteCatConfirm) return;
        mediumHaptic();
        removeHomeExpenseCategory(deleteCatConfirm);
        setDeleteCatConfirm(null);
      }}
      title="Delete category?"
      body={`This category is used on ${deleteCatCount} expense${deleteCatCount !== 1 ? 's' : ''} in this home. Deleting it won't remove those expenses.`}
      confirmLabel="Delete"
      confirmVariant="destructive"
    />
    </>
  );
}

export default function HomeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myName = useMyName();
  const { homes, history, homePayments, deleteHome, closeHome, reopenHome, updateHome, addHomePayment, removeHomePaymentsFor } = useSplitStore();

  const home = homes.find((h) => h.id === id);
  const [actionsModal, setActionsModal] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [payModal, setPayModal] = useState<{ from: string; to: string; amount: number } | null>(null);
  const [reopenConfirm, setReopenConfirm] = useState<{ from: string; to: string } | null>(null);
  const [totalsExpanded, setTotalsExpanded] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const activeSwipeable = useRef<Swipeable | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-based
  const [scopePerson, setScopePerson] = useState('');
  const [scopeDropOpen, setScopeDropOpen] = useState(false);
  const [scopeDropPos, setScopeDropPos] = useState<{ top: number; right: number } | null>(null);
  const scopeBtnRef = useRef<View>(null);

  const homeExpenses = useMemo(() =>
    history.filter((r) => r.homeId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history, id],
  );

  const monthExpenses = useMemo(() =>
    homeExpenses.filter((r) => {
      const iso = getHomeExpenseDate(r);
      const [y, mo] = iso.split('-').map(Number);
      return y === viewYear && mo - 1 === viewMonth;
    }),
    [homeExpenses, viewYear, viewMonth],
  );

  const personTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const exp of monthExpenses) {
      if (exp.personAmounts && exp.personAmounts.length > 0) {
        for (const pa of exp.personAmounts) {
          totals[pa.name] = (totals[pa.name] ?? 0) + pa.amount;
        }
      }
    }
    return Object.entries(totals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpenses]);

  const { catData, catTotal } = useMemo(() => getCategoryData(monthExpenses, scopePerson), [monthExpenses, scopePerson]);

  const myHomePayments = useMemo(() =>
    (homePayments ?? []).filter((p) => {
      if (p.homeId !== id) return false;
      const d = new Date(p.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }),
    [homePayments, id, viewYear, viewMonth],
  );

  const settlementInput = useMemo(() => [
    ...monthExpenses.map((e) => ({ personAmounts: e.personAmounts, paidByName: e.paidByName })),
    ...myHomePayments.map((p) => ({
      paidByName: p.from,
      personAmounts: [{ name: p.to, amount: p.amount }],
    })),
  ], [monthExpenses, myHomePayments]);

  const settlements = useMemo(() =>
    calculateTripSettlement(settlementInput),
    [settlementInput],
  );

  const visibleSettlement = useMemo(() =>
    scopePerson ? settlements.filter((t) => t.from === scopePerson || t.to === scopePerson) : settlements,
    [settlements, scopePerson],
  );

  // Debts fully covered by recorded payments but no longer active in the (payment-netted)
  // `settlements` above — i.e. actually closed, not just reshuffled by the greedy settle-up
  // algorithm. Computed against the payment-less base settlement so a pair's "original amount
  // owed" is stable even as other pairs' netting shifts around it. Same pattern as trip/[id].tsx.
  const baseSettlement = useMemo(() => calculateTripSettlement(
    monthExpenses.map((e) => ({ personAmounts: e.personAmounts, paidByName: e.paidByName })),
  ), [monthExpenses]);
  const closedSettlement = useMemo(() => {
    const activeKeys = new Set(settlements.map((t) => `${t.from}→${t.to}`));
    return baseSettlement
      .map((t) => ({
        ...t,
        paid: myHomePayments.filter((p) => p.from === t.from && p.to === t.to).reduce((sum, p) => sum + p.amount, 0),
      }))
      .filter((t) => t.paid >= t.amount - 0.005 && !activeKeys.has(`${t.from}→${t.to}`));
  }, [baseSettlement, settlements, myHomePayments]);
  const visibleClosedSettlement = useMemo(() =>
    scopePerson ? closedSettlement.filter((t) => t.from === scopePerson || t.to === scopePerson) : closedSettlement,
    [closedSettlement, scopePerson],
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  if (!home) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.textSub, fontFamily: 'Poppins_400Regular' }}>Home not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const homePeople = sortWithMeFirst(home.members, myName);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        headerTitleAlign: 'center',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        headerTitle: () => (
          <View style={{ alignItems: 'center' }}>
            <Text style={s.hdrTitle}>{home.name}</Text>
            <View style={s.hdrMonthNavRow}>
              <CircleIconButton variant="back" size={20} color={C.primary} onPress={prevMonth} hitSlop={10} />
              <Text style={s.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
              <CircleIconButton variant="back" size={20} color={isCurrentMonth ? C.textDim : C.primary} onPress={nextMonth}
                disabled={isCurrentMonth} hitSlop={10} style={{ transform: [{ rotate: '180deg' }] }} />
            </View>
          </View>
        ),
        headerLeft: () => (
          <CircleIconButton variant="back" size={28} color={C.primary} onPress={() => router.replace('/(tabs)/homes' as any)} style={{ paddingHorizontal: 12 }} />
        ),
        headerRight: () => (
          <PressBtn onPress={() => setActionsModal(true)} activeOpacity={0.5} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <MoreIcon color={C.text} size={20} />
          </PressBtn>
        ),
      }} />

      {/* Member bubbles strip */}
      {homePeople.length > 0 && (
        <View style={s.friendStrip}>
          {homePeople.slice(0, 8).map((name, i) => (
            <Avatar
              key={name}
              name={name}
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
            <Text style={s.totalBarAmt}>{getCurrencySymbol('USD')}{Math.round(catTotal)}</Text>
          </View>
          <PressBtn
            ref={scopeBtnRef}
            style={s.scopeDrop}
            onPress={() => {
              selectionHaptic();
              if (scopeBtnRef.current) {
                scopeBtnRef.current.measureInWindow((x, y, w, h) => {
                  const sw = Dimensions.get('window').width;
                  setScopeDropPos({ top: y + h + 4, right: sw - x - w });
                  setScopeDropOpen(true);
                });
              } else {
                setScopeDropOpen((o) => !o);
              }
            }}
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
          ...homePeople.filter((n) => n !== myName).map((n) => ({ label: n, value: n })),
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

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Dashboard ── */}
        <>
            {/* Spending by category pie chart */}
            {monthExpenses.length > 0 && (
              <View style={[s.section, { paddingTop: 4 }]}>
                <View style={s.pieSection}>
                  {catData.length === 0 ? (
                    <Text style={s.noDataNote}>No expense data yet.</Text>
                  ) : (
                    <View style={s.pieRow}>
                      <PieDonut data={catData} centerText={fmt(catTotal)} />
                      <View style={s.pieLegend}>
                        {catData.map(({ label, value, color, textColor }) => (
                          <View key={label} style={s.legendRow}>
                            <View style={[s.legendDot, { backgroundColor: color }]} />
                            <Text style={[s.legendAmt, { color: textColor }]} numberOfLines={1}>{fmt(value)}</Text>
                            <Text style={[s.legendLabel, { color: textColor }]} numberOfLines={1}>{label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* WHO OWES WHO */}
            {visibleSettlement.length > 0 && (
              <View style={s.section}>
                <SectionLabel style={{ marginBottom: 8 }}>WHO OWES WHO</SectionLabel>
                <View style={{ gap: 8 }}>
                  {visibleSettlement.map((txn, i) => {
                    const fromIdx = homePeople.indexOf(txn.from);
                    const avatarIdx = fromIdx >= 0 ? fromIdx : i;
                    const paidSoFar = myHomePayments
                      .filter((p) => p.from === txn.from && p.to === txn.to)
                      .reduce((sum, p) => sum + p.amount, 0);
                    return (
                      <SettlementRow
                        key={i}
                        txn={txn}
                        avatarIdx={avatarIdx}
                        scopePerson={scopePerson}
                        myName={myName}
                        paidSoFar={paidSoFar}
                        onPress={() => { selectionHaptic(); setPayModal({ from: txn.from, to: txn.to, amount: txn.amount }); }}
                        onMarkPaid={() => { selectionHaptic(); addHomePayment(home.id, txn.from, txn.to, txn.amount); }}
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

            {/* PAID / closed debts */}
            {visibleClosedSettlement.length > 0 && (
              <View style={s.section}>
                <SectionLabel style={{ marginBottom: 8 }}>PAID</SectionLabel>
                <View style={{ gap: 8 }}>
                  {visibleClosedSettlement.map((txn, i) => {
                    const fromIdx = homePeople.indexOf(txn.from);
                    const avatarIdx = fromIdx >= 0 ? fromIdx : i;
                    return (
                      <ClosedSettlementRow
                        key={i}
                        txn={txn}
                        avatarIdx={avatarIdx}
                        scopePerson={scopePerson}
                        myName={myName}
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

            {monthExpenses.length > 0 && visibleSettlement.length === 0 && (
              <View style={s.section}>
                <Card row={false} padding={0} radius={14} style={{ overflow: 'hidden' }}>
                  <View style={s.settleCard}>
                    <CheckCircleIcon color={C.success} size={16} />
                    <Text style={[s.settleOwes, { color: C.success, marginLeft: 4 }]}>All settled up for {MONTH_NAMES[viewMonth]}!</Text>
                  </View>
                </Card>
              </View>
            )}
            {monthExpenses.length > 0 && visibleSettlement.length === 0 && personTotals.length > 0 && (
              <Text style={s.noSettlementNote}>Set a payer on each expense to see who owes who.</Text>
            )}

            {/* Running totals per person */}
            {personTotals.length > 0 && (
              <View style={s.section}>
                <PressBtn style={s.sectionHeaderRow} onPress={() => { selectionHaptic(); setTotalsExpanded((e) => !e); }} activeOpacity={1} noShadow>
                  <SectionLabel style={{ marginBottom: 0 }}>RUNNING TOTALS</SectionLabel>
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
                  />
                )}
              </View>
            )}

            {monthExpenses.length === 0 && (
              <View style={s.emptySection}>
                <Text style={s.emptySectionText}>No expenses in {MONTH_NAMES[viewMonth]} — add the first one below.</Text>
              </View>
            )}
        </>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Expenses"
          icon={<ExpenseIcon color={C.text} size={18} />}
          onPress={() => { selectionHaptic(); router.push({ pathname: '/home/expenses' as any, params: { homeId: id! } }); }}
        />
      </View>

      {payModal && (
        <PayModal
          from={payModal.from} to={payModal.to} maxAmount={payModal.amount}
          breakdown={monthExpenses
            .filter((e) => e.personAmounts?.some((p) => p.name === payModal.from && p.amount > 0))
            .map((e) => ({ name: e.restaurantName || 'Expense', amount: e.personAmounts?.find((p) => p.name === payModal.from)?.amount ?? 0 }))}
          paymentHistory={homePayments
            .filter((p) => p.homeId === home.id && p.from === payModal.from && p.to === payModal.to)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p) => ({ amount: p.amount, date: p.date }))}
          onClose={() => setPayModal(null)}
          onConfirm={(amount) => { mediumHaptic(); addHomePayment(home.id, payModal.from, payModal.to, amount); setPayModal(null); }}
        />
      )}

      {/* Edit home modal */}
      {editVisible && (
        <EditHomeModal
          home={home}
          onClose={() => setEditVisible(false)}
          onSave={(name, emoji, members, startDate, endDate) => {
            updateHome(home.id, name, emoji, members, startDate || undefined, endDate || undefined);
            setEditVisible(false);
          }}
        />
      )}

      {/* Actions modal */}
      <Modal visible={actionsModal} transparent animationType="none" onRequestClose={() => setActionsModal(false)}>
        <Pressable style={s.actionsBackdrop} onPress={() => setActionsModal(false)}>
          <View style={s.actionsCard}>
            <PressBtn style={s.actionsRow} onPress={() => { setActionsModal(false); setEditVisible(true); }} activeOpacity={0.6}>
              <PencilIcon color={C.textSub} size={17} />
              <Text style={s.actionsRowText}>Edit</Text>
            </PressBtn>
            {home.status !== 'closed' ? (
              <PressBtn style={[s.actionsRow, s.actionsRowDivider]} onPress={() => { setActionsModal(false); closeHome(home.id); }} activeOpacity={0.6}>
                <CheckCircleIcon color={C.textSub} size={17} />
                <Text style={s.actionsRowText}>Close home</Text>
              </PressBtn>
            ) : (
              <PressBtn style={[s.actionsRow, s.actionsRowDivider]} onPress={() => { setActionsModal(false); reopenHome(home.id); }} activeOpacity={0.6}>
                <ReopenIcon size={17} color={C.textSub} />
                <Text style={s.actionsRowText}>Reopen</Text>
              </PressBtn>
            )}
            <PressBtn style={[s.actionsRow, s.actionsRowDivider]} onPress={() => { setActionsModal(false); setDeleteConfirm(true); }} activeOpacity={0.6}>
              <TrashIcon color={C.error} size={17} />
              <Text style={[s.actionsRowText, { color: C.error }]}>Delete</Text>
            </PressBtn>
          </View>
        </Pressable>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        visible={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => { mediumHaptic(); deleteHome(home.id); router.back(); }}
        title={`Delete ${home.name}?`}
        body="This will remove the home and all its expenses. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
      />

      <ConfirmModal
        visible={!!reopenConfirm}
        onClose={() => setReopenConfirm(null)}
        onConfirm={() => {
          if (!reopenConfirm) return;
          selectionHaptic();
          removeHomePaymentsFor(home.id, reopenConfirm.from, reopenConfirm.to);
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

  // Header (matches trip/[id].tsx)
  hdrTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text, letterSpacing: 0.3 },
  hdrMonthNavRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -2 },
  friendStrip: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4, paddingBottom: 4 },
  hdrAvatar: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.bg },

  scrollContent: { paddingBottom: 24 },

  monthLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub },

  // Total + person scope dropdown (identical to trip/[id].tsx)
  totalBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  totalBarLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: C.textSub, letterSpacing: 0.8 },
  totalBarAmt: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text, lineHeight: 30 },
  scopeDrop: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  scopeDropText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.text },
  scopeDropItemText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },

  section: { paddingHorizontal: 16, paddingTop: 16 },
  emptySection: { alignItems: 'center', paddingVertical: 40 },
  emptySectionText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textDim, textAlign: 'center' },

  // Pie chart
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

  // Settlement cards (matches trip/[id].tsx)
  settleCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  settleOwes: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: C.text },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  noSettlementNote: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textDim, textAlign: 'center', marginTop: 12, marginHorizontal: 16, fontStyle: 'italic' },

  footer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: C.bg, borderRadius: 20, padding: 20, maxHeight: '88%' },
  modalTitle: { fontFamily: 'Poppins_900Black', fontSize: 24, color: C.text, marginBottom: 12 },

  // Edit modal — mirrors trip/[id].tsx exactly
  editDateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  editDateText: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },
  friendAddRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: InputMetrics.height, gap: 10 },
  friendAddInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text },
  friendListName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },
  editInput: { fontFamily: 'Poppins_500Medium', fontSize: 15 },

  // Actions modal (matches trip/[id].tsx)
  actionsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  actionsCard: { position: 'absolute', top: 54, right: 10, backgroundColor: C.bg, borderRadius: 14, width: 210, overflow: 'hidden' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  actionsRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  actionsRowText: { fontFamily: 'Poppins_400Regular', fontSize: 16, color: C.text },
});
