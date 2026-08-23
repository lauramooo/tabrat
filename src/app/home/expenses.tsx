import { PressBtn } from '@/components/PressBtn';
import { BillTypeIcon, CalendarIcon, CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, ExpenseIcon, LinkIcon, PlusIcon, ReceiptIcon, TrashIcon } from '@/components/FigmaIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { ActionPill } from '@/components/ActionPill';
import { Button, Card, CenteredModal, CircleIconButton, Dropdown, DropdownRow, FieldLabel, IconBadge, Input, SectionLabel } from '@/components/design';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { fmt, getCurrencySymbol, sanitizeNumberInput } from '@/utils/calculator';
import { getCategoryColorMap, getCategoryData } from '@/utils/categoryColors';
import { fmtDate } from '@/utils/date';
import { mediumHaptic, selectionHaptic, lightHaptic } from '@/utils/haptics';
import type { SplitRecord } from '@/types';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toInputDate(str: string): string {
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromInputDate(val: string): string {
  const formatted = fmtDate(val + 'T00:00:00');
  return formatted || val;
}

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

// ── Add expense modal (exact copy of home/[id].tsx's) ────────────────────────

function AddExpenseModal({ visible, onClose, members, categories, homeId }: {
  visible: boolean; onClose: () => void; members: string[]; categories: string[]; homeId: string;
}) {
  const { saveHomeExpenseDirectly } = useSplitStore();
  const myName = useMyName();
  const people = useMemo(() => sortWithMeFirst(members, myName), [members, myName]);
  const today = () => fmtDate(new Date());

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [catOpen, setCatOpen] = useState(false);
  const [catDropPos, setCatDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const catBtnRef = useRef<View>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(''); setAmount(''); setCategory(null); setCatOpen(false);
      setDate(today()); setError(null);
      const sorted = sortWithMeFirst(members, myName);
      setParticipants([...sorted]);
      setPaidBy(sorted[0] ?? null);
    }
  }, [visible]);

  const toggleParticipant = (p: string) => {
    selectionHaptic();
    setParticipants((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      if (paidBy && !next.includes(paidBy)) setPaidBy(next[0] ?? null);
      return next;
    });
  };

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!name.trim()) { setError('Enter an expense name'); return; }
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!paidBy) { setError('Select who paid'); return; }
    mediumHaptic();
    saveHomeExpenseDirectly({
      name: name.trim(), receiptDate: date, category,
      amount: amt, participants: participants.length > 0 ? participants : members,
      paidByName: paidBy, homeId,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={() => setCatOpen(false)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[s.modalTitle, { fontFamily: 'Poppins_700Bold', fontSize: 17, marginBottom: 0, lineHeight: 20 }]}>Add expense</Text>
            <CircleIconButton variant="close" size={20} color={C.text} onPress={onClose} />
          </View>
          <View style={{ position: 'relative', flexShrink: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <FieldLabel style={{ marginBottom: 6 }}>NAME</FieldLabel>
            <Card row={false} padding={0} radius={10} style={{ marginBottom: 16, overflow: 'hidden' }}>
              <View style={s.expRow}>
                <TextInput style={[s.expInput, { outlineWidth: 0 } as any]}
                  value={name} onChangeText={(v) => { setName(v); setError(null); }}
                  placeholder="Rent, electricity, groceries…" placeholderTextColor={C.textDim}
                  autoFocus returnKeyType="next" />
              </View>
            </Card>

            <FieldLabel style={{ marginBottom: 6 }}>CATEGORY</FieldLabel>
            <Card row={false} padding={0} radius={10} style={{ marginBottom: 16, overflow: 'hidden' }}>
              <PressBtn
                ref={catBtnRef}
                style={s.expRow}
                onPress={() => {
                  selectionHaptic();
                  if (catBtnRef.current) {
                    catBtnRef.current.measureInWindow((x, y, w, h) => {
                      setCatDropPos({ top: y + h + 4, left: x, width: w });
                      setCatOpen(true);
                    });
                  } else {
                    setCatOpen((o) => !o);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.expText, { flex: 1 }, !category && { color: C.textDim }]}>{category ?? 'Select category'}</Text>
                {catOpen
                  ? <ChevronUpCircleIcon color={C.text} size={15} />
                  : <ChevronDownCircleIcon color={C.text} size={15} />}
              </PressBtn>
            </Card>
            <Dropdown visible={catOpen} position={catDropPos} onClose={() => setCatOpen(false)}>
              {categories.map((cat, i) => (
                <DropdownRow
                  key={cat}
                  onPress={() => { selectionHaptic(); setCategory(category === cat ? null : cat); setCatOpen(false); }}
                  divider={i > 0}
                  trailing={category === cat ? <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" /> : undefined}
                >
                  <Text style={[s.expText, category === cat && { color: C.primary, fontFamily: 'Poppins_600SemiBold' }]}>{cat}</Text>
                </DropdownRow>
              ))}
            </Dropdown>

            <FieldLabel style={{ marginBottom: 6 }}>DATE</FieldLabel>
            <Card row={false} padding={0} radius={10} style={{ marginBottom: 16, overflow: 'hidden' }}>
              <View style={s.expRow}>
                <CalendarIcon size={15} color={C.text} />
                {Platform.OS === 'web' ? (
                  <View style={{ flex: 1, position: 'relative' }}>
                    <Text style={[s.expText, !date && { color: C.textDim }]}>{date || 'Select date'}</Text>
                    {createElement('input', {
                      type: 'date', value: toInputDate(date),
                      onChange: (e: any) => { const v = e.target.value; if (v) setDate(fromInputDate(v)); },
                      style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' } as any,
                    })}
                  </View>
                ) : (
                  <TextInput style={[s.expInput, { outlineWidth: 0 } as any]}
                    value={date} onChangeText={setDate}
                    placeholder="Jun 1, 2025" placeholderTextColor={C.textDim} />
                )}
              </View>
            </Card>

            <FieldLabel style={{ marginBottom: 6 }}>AMOUNT</FieldLabel>
            <Card row={false} padding={0} radius={10} style={[s.moneyCard, amountFocused && s.moneyCardFocused, { overflow: 'hidden' }]}>
              <View style={[s.expRow, { gap: 4 }]}>
                <Text style={s.moneyPrefix}>$</Text>
                <TextInput style={[s.expInput, { outlineWidth: 0 } as any]}
                  value={amount} onChangeText={(v) => { setAmount(sanitizeNumberInput(v)); setError(null); }}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim}
                  onFocus={() => setAmountFocused(true)} onBlur={() => setAmountFocused(false)} />
              </View>
            </Card>

            {people.length > 0 && (
              <>
                <FieldLabel style={{ marginBottom: 6 }}>{`MEMBERS${participants.length > 0 ? `  (${participants.length})` : ''}`}</FieldLabel>
                <View style={s.expChipsWrap}>
                  {people.map((p, i) => (
                    <PersonChip key={p} name={p} index={i} selected={participants.includes(p)} onPress={() => toggleParticipant(p)} />
                  ))}
                </View>
              </>
            )}

            {participants.length > 0 && (
              <>
                <FieldLabel style={{ marginTop: 16, marginBottom: 6 }}>WHO PAID?</FieldLabel>
                <View style={s.expChipsWrap}>
                  {participants.map((p) => {
                    const i = people.indexOf(p);
                    return (
                      <PersonChip
                        key={p}
                        name={p}
                        index={i >= 0 ? i : 0}
                        selected={paidBy === p}
                        onPress={() => { selectionHaptic(); setPaidBy(p); }}
                      />
                    );
                  })}
                </View>
              </>
            )}

            {error && <Text style={{ color: C.error, fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 12 }}>{error}</Text>}
            <View style={{ height: 16 }} />
          </ScrollView>
          <LinearGradient colors={[`${C.bg}00`, C.bg]} pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
            <Button variant="primary" size="small" label="Save" onPress={handleSave} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Quick edit modal for home expenses (exact copy of home/[id].tsx's) ───────

function HomeQuickEditModal({ exp, categories, onClose }: {
  exp: SplitRecord; categories: string[]; onClose: () => void;
}) {
  const { updateRecord } = useSplitStore();
  const [name, setName] = useState(exp.restaurantName ?? '');
  const [date, setDate] = useState(exp.receiptDate ?? '');
  const [catOpen, setCatOpen] = useState(false);
  const [catDropPos, setCatDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const catBtnRef = useRef<View>(null);
  const [category, setCategory] = useState<string | null>(exp.expenseCategory ?? null);

  const handleSave = () => {
    mediumHaptic();
    updateRecord(exp.id, {
      restaurantName: name.trim() || undefined,
      receiptDate: date || undefined,
      expenseCategory: category ?? undefined,
    });
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={() => setCatOpen(false)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[s.modalTitle, { fontFamily: 'Poppins_700Bold', fontSize: 17, marginBottom: 0, lineHeight: 20 }]}>Edit expense</Text>
            <CircleIconButton variant="close" size={20} color={C.text} onPress={onClose} />
          </View>

          <FieldLabel style={{ marginBottom: 6 }}>NAME</FieldLabel>
          <Input
            style={[s.editInput, { marginBottom: 14, outlineWidth: 0 } as any]}
            value={name} onChangeText={setName}
            placeholder="Expense name" placeholderTextColor={C.textDim}
            autoFocus returnKeyType="done"
          />

          <FieldLabel style={{ marginBottom: 6 }}>DATE</FieldLabel>
          <Card row={false} padding={0} radius={10} style={{ marginBottom: 14, overflow: 'hidden' }}>
            <View style={s.expRow}>
              <CalendarIcon size={15} color={C.text} />
              {Platform.OS === 'web' ? (
                <View style={{ flex: 1, position: 'relative' }}>
                  <Text style={[s.expText, !date && { color: C.textDim }]}>{date || 'Select date'}</Text>
                  {createElement('input', {
                    type: 'date', value: toInputDate(date),
                    onChange: (e: any) => { const v = e.target.value; if (v) setDate(fromInputDate(v)); },
                    style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' } as any,
                  })}
                </View>
              ) : (
                <Text style={[s.expText, { flex: 1 }, !date && { color: C.textDim }]}>{date || 'Select date'}</Text>
              )}
            </View>
          </Card>

          <FieldLabel style={{ marginBottom: 6 }}>CATEGORY</FieldLabel>
          <Card row={false} padding={0} radius={10} style={{ marginBottom: 16, overflow: 'hidden' }}>
            <PressBtn
              ref={catBtnRef}
              style={s.expRow}
              onPress={() => {
                selectionHaptic();
                if (catBtnRef.current) {
                  catBtnRef.current.measureInWindow((x, y, w, h) => {
                    setCatDropPos({ top: y + h + 4, left: x, width: w });
                    setCatOpen(true);
                  });
                } else {
                  setCatOpen((o) => !o);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.expText, { flex: 1 }, !category && { color: C.textDim }]}>{category ?? 'Select category'}</Text>
              {catOpen
                ? <ChevronUpCircleIcon color={C.text} size={15} />
                : <ChevronDownCircleIcon color={C.text} size={15} />}
            </PressBtn>
          </Card>
          <Dropdown visible={catOpen} position={catDropPos} onClose={() => setCatOpen(false)}>
            {categories.map((cat, i) => (
              <DropdownRow
                key={cat}
                onPress={() => { selectionHaptic(); setCategory(cat); setCatOpen(false); }}
                divider={i > 0}
                trailing={category === cat ? <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" /> : undefined}
              >
                <Text style={[s.expText, category === cat && { color: C.primary, fontFamily: 'Poppins_600SemiBold' }]}>{cat}</Text>
              </DropdownRow>
            ))}
          </Dropdown>

          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
            <Button variant="primary" size="small" label="Save" onPress={handleSave} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Swipeable home expense row (exact copy of home/[id].tsx's) ───────────────

function HomeExpenseRow({ exp, catColor, onDelete, onEdit, onOpen }: {
  exp: SplitRecord; catColor?: { bg: string; text: string }; onDelete: () => void; onEdit: () => void;
  onOpen: (ref: Swipeable) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const isManual = exp.source === 'manual';
  const badgeBg = isManual ? AVATAR_PALETTE[4].bg : C.billBg;
  const badgeFg = isManual ? AVATAR_PALETTE[4].text : C.billFg;
  const renderRightActions = (progress: any) => (
    <ActionPill progress={progress} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
      onPress={() => { swipeRef.current?.close(); onDelete(); }} />
  );
  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false} friction={2} rightThreshold={40}
      onSwipeableOpen={() => { if (swipeRef.current) onOpen(swipeRef.current); }}>
      <Card padding={10} onPress={onEdit} pressBorderColor={badgeBg}>
        <IconBadge size={26} bg={badgeBg}>
          {isManual ? <ExpenseIcon color={badgeFg} size={11} /> : <BillTypeIcon color={badgeFg} size={11} />}
        </IconBadge>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={[s.tabName, { flex: 1 }]} numberOfLines={1}>{exp.restaurantName || exp.expenseCategory || 'Expense'}</Text>
            <View style={[s.catBadge, catColor && { backgroundColor: catColor.bg }]}>
              <Text style={[s.catBadgeText, catColor && { color: catColor.text }]}>{exp.expenseCategory || 'Uncategorized'}</Text>
            </View>
            <Text style={s.tabTotal}>{fmt(exp.total)}</Text>
          </View>
        </View>
      </Card>
    </Swipeable>
  );
}

export default function HomeExpensesScreen() {
  const { homeId } = useLocalSearchParams<{ homeId: string }>();
  const router = useRouter();
  const myName = useMyName();
  const { homes, history, homeExpenseCategories, deleteHistory, startHomeEntry, linkTabToHome, saveHomeExpenseDirectly } = useSplitStore();

  const home = homes.find((h) => h.id === homeId);
  const [addVisible, setAddVisible] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [quickEditExp, setQuickEditExp] = useState<SplitRecord | null>(null);
  const activeSwipeable = useRef<Swipeable | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-based
  const [scopePerson, setScopePerson] = useState('');
  const [scopeDropOpen, setScopeDropOpen] = useState(false);
  const [scopeDropPos, setScopeDropPos] = useState<{ top: number; right: number } | null>(null);
  const scopeBtnRef = useRef<View>(null);

  const todayISO = useMemo(() =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    [],
  );
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(() =>
    (now.getFullYear() === viewYear && now.getMonth() === viewMonth) ? todayISO : null,
  );
  const isFirstMonthRender = useRef(true);
  useEffect(() => {
    if (isFirstMonthRender.current) { isFirstMonthRender.current = false; return; }
    const n = new Date();
    setSelectedDayISO((n.getFullYear() === viewYear && n.getMonth() === viewMonth) ? todayISO : null);
  }, [viewYear, viewMonth]);
  const dayScrollRef = useRef<FlatList<any>>(null);
  const [dayStripW, setDayStripW] = useState(0);

  const [quickName, setQuickName] = useState('');
  const [quickAmountText, setQuickAmountText] = useState('');
  const [quickPayer, setQuickPayer] = useState<string | null>(null);
  const [quickPayerDropOpen, setQuickPayerDropOpen] = useState(false);
  const [quickPayerDropPos, setQuickPayerDropPos] = useState<{ bottom: number; right: number } | null>(null);
  const quickPayerBtnRef = useRef<View>(null);
  const [quickNameFocused, setQuickNameFocused] = useState(false);
  const [quickAmountFocused, setQuickAmountFocused] = useState(false);

  const importableBills = useMemo(() =>
    history.filter((r) => !r.homeId && !r.tripId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history],
  );

  const homeExpenses = useMemo(() =>
    history.filter((r) => r.homeId === homeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history, homeId],
  );

  const monthExpenses = useMemo(() =>
    homeExpenses.filter((r) => {
      const iso = getHomeExpenseDate(r);
      const [y, mo] = iso.split('-').map(Number);
      return y === viewYear && mo - 1 === viewMonth;
    }),
    [homeExpenses, viewYear, viewMonth],
  );

  const scopedExpenses = useMemo(() =>
    scopePerson ? monthExpenses.filter((e) => e.personAmounts?.some((p) => p.name === scopePerson && p.amount > 0)) : monthExpenses,
    [monthExpenses, scopePerson],
  );

  const catData = useMemo(() => getCategoryData(monthExpenses, scopePerson).catData, [monthExpenses, scopePerson]);
  const catColorByLabel = useMemo(() => getCategoryColorMap(catData), [catData]);

  const filteredExpenses = useMemo(() =>
    selectedDayISO ? scopedExpenses.filter((e) => getHomeExpenseDate(e) === selectedDayISO) : scopedExpenses,
    [scopedExpenses, selectedDayISO],
  );

  const groupedExpenses = useMemo(() => {
    if (selectedDayISO) return null;
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    const yesterdayISO = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
    const map = new Map<string, SplitRecord[]>();
    for (const exp of scopedExpenses) {
      const iso = getHomeExpenseDate(exp);
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(exp);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([iso, items]) => ({
        iso,
        label: iso === todayISO ? 'Today' : iso === yesterdayISO ? 'Yesterday'
          : new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        items,
      }));
  }, [scopedExpenses, selectedDayISO]);

  const monthDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dt = new Date(iso + 'T00:00:00');
      return { iso, dayName: dt.toLocaleDateString('en-US', { weekday: 'short' }), dayNum: String(dayNum) };
    });
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (dayStripW === 0 || monthDays.length === 0) return;
    const targetISO = selectedDayISO ?? todayISO;
    const idx = monthDays.findIndex((d) => d.iso === targetISO);
    if (idx === -1) return;
    const ITEM_W = 38; const GAP = 10;
    const itemCenter = idx * (ITEM_W + GAP) + ITEM_W / 2;
    const offset = Math.max(0, itemCenter - dayStripW / 2);
    dayScrollRef.current?.scrollToOffset({ offset, animated: false });
  }, [dayStripW, monthDays]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const openScopeDropdown = () => {
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
  };

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
  const categories = homeExpenseCategories;

  const handleQuickSave = () => {
    if (!canSaveQuick || !quickPayer) return;
    mediumHaptic();
    saveHomeExpenseDirectly({
      name: quickName.trim(),
      receiptDate: fmtDate(new Date()),
      category: null,
      amount: quickAmount,
      participants: home.members,
      paidByName: quickPayer,
      homeId: home.id,
    });
    setQuickName('');
    setQuickAmountText('');
    setQuickPayer(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: `${home.name} expenses`,
        headerTitleAlign: 'left',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        headerLeft: () => (
          <CircleIconButton variant="back" size={28} color={C.primary} onPress={() => router.back()} style={{ paddingHorizontal: 12 }} />
        ),
      }} />

      <View style={s.expHeaderRow}>
        <View style={s.monthNavGroup}>
          <CircleIconButton variant="back" size={18} color={C.primary} onPress={prevMonth} hitSlop={10} />
          <Text style={s.monthNavLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
          <CircleIconButton variant="back" size={18} color={isCurrentMonth ? C.textDim : C.primary} onPress={nextMonth}
            disabled={isCurrentMonth} hitSlop={10} style={{ transform: [{ rotate: '180deg' }] }} />
        </View>
        <PressBtn ref={scopeBtnRef} style={s.scopeDrop} onPress={openScopeDropdown} activeOpacity={0.8}>
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
        <View style={s.section}>
          {monthDays.length >= 1 && (
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
                data={monthDays}
                keyExtractor={(day) => day.iso}
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 10 }}
                onLayout={(e) => setDayStripW(e.nativeEvent.layout.width)}
                getItemLayout={(_, index) => ({ length: 38, offset: (38 + 10) * index, index })}
                initialNumToRender={31}
                windowSize={11}
                renderItem={({ item: day }) => {
                  const isSelected = selectedDayISO === day.iso;
                  const isToday = day.iso === todayISO;
                  return (
                    <PressBtn style={s.dayBadgeWrap}
                      onPress={() => { selectionHaptic(); setSelectedDayISO(isSelected ? null : day.iso); }} activeOpacity={0.75} noShadow>
                      <Text
                        style={[s.dayBadgeWeekday, isSelected && s.dayBadgeWeekdayActive]}
                        numberOfLines={1}
                      >
                        {isToday ? 'TODAY' : day.dayName.toUpperCase()}
                      </Text>
                      <View style={[s.dayBadgeCircle, isSelected && s.dayBadgeCircleActive]}>
                        <Text style={[s.dayBadgeNum, isSelected && s.dayBadgeNumActive]}>{day.dayNum}</Text>
                      </View>
                      <View style={[s.dayBadgeDot, isToday && s.dayBadgeDotActive]} />
                    </PressBtn>
                  );
                }}
              />
            </View>
          )}

          {filteredExpenses.length === 0 ? (
            <View style={s.emptySection}>
              <Text style={s.emptySectionText}>{selectedDayISO ? 'No expenses on this day.' : 'No expenses yet — add the first one below.'}</Text>
            </View>
          ) : groupedExpenses ? (
            <View style={{ gap: 24 }}>
              {groupedExpenses.map((group) => (
                <View key={group.iso}>
                  <SectionLabel style={{ marginBottom: 10 }}>{group.label}</SectionLabel>
                  <View style={{ gap: 8 }}>
                    {group.items.map((exp) => (
                      <HomeExpenseRow
                        key={exp.id}
                        exp={exp}
                        catColor={catColorByLabel.get(exp.expenseCategory ?? 'Other')}
                        onDelete={() => { lightHaptic(); deleteHistory(exp.id); }}
                        onEdit={() => { selectionHaptic(); setQuickEditExp(exp); }}
                        onOpen={(ref) => {
                          if (activeSwipeable.current && activeSwipeable.current !== ref) activeSwipeable.current.close();
                          activeSwipeable.current = ref;
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {filteredExpenses.map((exp) => (
                <HomeExpenseRow
                  key={exp.id}
                  exp={exp}
                  catColor={catColorByLabel.get(exp.expenseCategory ?? 'Other')}
                  onDelete={() => { lightHaptic(); deleteHistory(exp.id); }}
                  onEdit={() => { selectionHaptic(); setQuickEditExp(exp); }}
                  onOpen={(ref) => {
                    if (activeSwipeable.current && activeSwipeable.current !== ref) activeSwipeable.current.close();
                    activeSwipeable.current = ref;
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

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
            <Text style={s.moneyPrefix}>{getCurrencySymbol('USD')}</Text>
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
          {homePeople.map((name, i) => (
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

      {/* Footer */}
      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Add"
          icon={<PlusIcon color={C.text} size={20} />}
          onPress={() => { mediumHaptic(); setAddSheetVisible(true); }}
        />
      </View>

      <AddExpenseModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        members={home.members}
        categories={categories}
        homeId={home.id}
      />

      {quickEditExp && (
        <HomeQuickEditModal
          exp={quickEditExp}
          categories={categories}
          onClose={() => setQuickEditExp(null)}
        />
      )}

      {/* Add action sheet */}
      <CenteredModal visible={addSheetVisible} onClose={() => setAddSheetVisible(false)} padding={24} title={<Text style={s.sheetTitle}>Add to home</Text>}>
        <View style={{ gap: 10 }}>
          {[
            { label: 'Expense', desc: 'Log a single cost without a receipt', badgeBg: AVATAR_PALETTE[4].bg, color: AVATAR_PALETTE[4].text, Icon: ExpenseIcon, onPress: () => { setAddSheetVisible(false); setAddVisible(true); } },
            { label: 'Bill', desc: 'Scan or upload a new receipt to split', badgeBg: C.billBg, color: C.billFg, Icon: BillTypeIcon, onPress: () => { setAddSheetVisible(false); startHomeEntry(home.id); router.push('/upload'); } },
            { label: 'Link Bill', desc: 'Connect a bill you already split to this home', badgeBg: AVATAR_PALETTE[3].bg, color: AVATAR_PALETTE[3].text, Icon: LinkIcon, onPress: () => { setAddSheetVisible(false); setImportVisible(true); } },
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

      {/* Link bill picker */}
      <Modal visible={importVisible} transparent animationType="fade" onRequestClose={() => setImportVisible(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setImportVisible(false)}>
          <Pressable style={[s.sheetCard, { maxHeight: '75%' }]} onPress={() => {}}>
            <View style={s.importHeader}>
              <Text style={s.sheetTitle}>Link bill</Text>
              <CircleIconButton variant="close" size={20} color={C.text} onPress={() => setImportVisible(false)} />
            </View>
            {importableBills.length === 0 ? (
              <View style={s.importEmpty}>
                <ReceiptIcon size={36} color={C.textDim} />
                <Text style={s.importEmptyText}>No standalone bills to import</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {importableBills.map((bill, i) => (
                  <PressBtn
                    key={bill.id}
                    style={[s.importRow, i < importableBills.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
                    onPress={() => { lightHaptic(); linkTabToHome(bill.id, home.id); setImportVisible(false); }}
                    activeOpacity={0.75}
                  >
                    <View style={s.importRowIcon}>
                      <ReceiptIcon size={16} color={C.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={s.importRowName} numberOfLines={1}>{bill.restaurantName || 'Unnamed bill'}</Text>
                      <Text style={s.importRowMeta}>{(bill.receiptDate && (fmtDate(bill.receiptDate) || bill.receiptDate)) || fmtDate(bill.date)} · {bill.people?.length ?? 0} people</Text>
                    </View>
                    <Text style={s.importRowAmt}>{fmt(bill.total)}</Text>
                  </PressBtn>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 24 },

  expHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 16, paddingTop: 14 },
  monthNavGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthNavLabel: { fontFamily: 'Poppins_700Bold', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.text },

  scopeDrop: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  scopeDropText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.text },
  scopeDropItemText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },

  section: { paddingHorizontal: 16, paddingTop: 4 },
  emptySection: { alignItems: 'center', paddingVertical: 40 },
  emptySectionText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textDim, textAlign: 'center' },

  // Day strip
  dayPickerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: 12 },
  dayPickerDivider: { width: 1, backgroundColor: C.border, borderRadius: 1 },
  dayStripAllWrap: { alignItems: 'center', justifyContent: 'center' },
  dayStripAllPill: { paddingHorizontal: 10, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  dayStripAllPillActive: { backgroundColor: C.tripBg },
  dayStripAll: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.textSub },
  dayStripAllActive: { color: C.text, fontFamily: 'Poppins_700Bold' },
  dayBadgeWrap: { alignItems: 'center', gap: 1, width: 38 },
  dayBadgeWeekday: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, color: C.textSub, letterSpacing: 0.2 },
  dayBadgeWeekdayActive: { color: C.text },
  dayBadgeCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  dayBadgeCircleActive: { backgroundColor: C.tripBg },
  dayBadgeDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: 'transparent' },
  dayBadgeDotActive: { backgroundColor: C.text },
  dayBadgeNum: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.text },
  dayBadgeNumActive: { fontFamily: 'Poppins_900Black' },

  expRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: InputMetrics.height },

  tabName: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  tabTotal: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: C.primaryDim },
  catBadgeText: { fontFamily: 'Poppins_500Medium', fontSize: 10, color: C.primary },

  footer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },

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

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: C.bg, borderRadius: 20, padding: 20, maxHeight: '88%' },
  modalTitle: { fontFamily: 'Poppins_900Black', fontSize: 24, color: C.text, marginBottom: 12 },

  // Add expense modal
  expInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, padding: 0 },
  moneyPrefix: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.textSub },
  moneyCard: { marginBottom: 16, borderWidth: 1.5, borderColor: 'transparent' },
  moneyCardFocused: { borderColor: C.text },
  expText: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },
  expChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },

  // Edit modal
  editInput: { fontFamily: 'Poppins_400Regular', fontSize: 15 },

  // Add sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  sheetCard: { backgroundColor: C.bg, borderRadius: 20, padding: 24 },
  sheetTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text, lineHeight: 26 },
  sheetOption: { gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14 },
  sheetOptionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: C.text },
  sheetOptionDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: 2 },

  // Link bill picker
  importHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  importEmpty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  importEmptyText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textDim },
  importRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  importRowIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: C.primaryDim, justifyContent: 'center', alignItems: 'center' },
  importRowName: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: C.text },
  importRowMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub },
  importRowAmt: { fontFamily: 'Poppins_900Black', fontSize: 16, color: C.text },
});
