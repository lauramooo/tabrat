import DateTimePicker from '@react-native-community/datetimepicker';
import { PressBtn } from '@/components/PressBtn';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, CenteredModal, CircleIconButton, DatePickerModal, Dropdown, DropdownRow, FieldLabel, Input } from '@/components/design';
import { CalendarIcon, CameraIcon, CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, CloseCircleIcon, PencilIcon, PlusCircleIcon, SearchIcon, SortIcon, TrashIcon, XMarkIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { fmt, getCurrencySymbol, sanitizeNumberInput } from '@/utils/calculator';
import { fmtDate } from '@/utils/date';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

// -- Date helpers --------------------------------------------------------------

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

// -- Date picker row -----------------------------------------------------------

function DateRow({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [showNative, setShowNative] = useState(false);
  const [iosDate, setIosDate] = useState(new Date());
  const handlePress = () => {
    setIosDate(value ? parseDisplay(value) : new Date());
    setShowNative(true);
  };

  const onNativeChange = (_: any, date?: Date) => {
    if (Platform.OS !== 'android') return;
    setShowNative(false);
    if (date) onChange(fmtDate(date));
  };

  return (
    <>
      {Platform.OS === 'web' ? (
        <View style={[s.detailRow, { position: 'relative' }]}>
          <CalendarIcon size={15} color={C.text} />
          <Text style={[s.detailText, !value && { color: C.textDim }]}>{value || placeholder}</Text>
          {createElement('input', {
            type: 'date',
            value: toISO(value),
            onChange: (e: any) => { const v = e.target.value; if (v) onChange(fromISO(v)); },
            style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any,
          })}
        </View>
      ) : (
        <PressBtn style={s.detailRow} onPress={handlePress} activeOpacity={0.8}>
          <CalendarIcon size={15} color={C.text} />
          <Text style={[s.detailText, !value && { color: C.textDim }]}>{value || placeholder}</Text>
          {value ? (
            <PressBtn onPress={() => onChange('')} hitSlop={8}>
              <CloseCircleIcon size={15} color={C.textDim} />
            </PressBtn>
          ) : null}
        </PressBtn>
      )}
      {showNative && Platform.OS === 'android' && (
        <DateTimePicker value={iosDate} mode="date" display="calendar" onChange={onNativeChange} />
      )}
      {Platform.OS === 'ios' && (
        <DatePickerModal
          visible={showNative}
          value={iosDate}
          onChange={(d) => onChange(fmtDate(d))}
          onClose={() => setShowNative(false)}
          title={placeholder}
        />
      )}
    </>
  );
}

// -- Category rename modal -----------------------------------------------------

function CategoryRenameModal({ cat, onClose }: { cat: string | null; onClose: () => void }) {
  const { history, updateExpenseCategory } = useSplitStore();
  const [value, setValue] = useState('');

  useEffect(() => { if (cat) setValue(cat); }, [cat]);

  const count = cat ? history.filter((r) => r.expenseCategory === cat).length : 0;

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed || !cat) { onClose(); return; }
    if (trimmed !== cat) updateExpenseCategory(cat, trimmed);
    onClose();
  };

  return (
    <CenteredModal visible={!!cat} onClose={onClose} title={<Text style={s.modalTitle}>Rename category</Text>}>
      <Input
        style={[s.catEditInput, { outlineWidth: 0, marginBottom: 12 } as any]}
        value={value}
        onChangeText={setValue}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSave}
        selectTextOnFocus
      />
      {count > 0 && (
        <Text style={s.renameNote}>
          Editing this category will apply the change to all expenses with this category ({count} expense{count !== 1 ? 's' : ''}).
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button variant="secondary" label="Cancel" onPress={onClose} />
        <Button variant="primary" label="Save" onPress={handleSave} />
      </View>
    </CenteredModal>
  );
}

// -- Main screen ---------------------------------------------------------------

export default function ManualEntryScreen() {
  const { tripId, expenseId, direct } = useLocalSearchParams<{ tripId: string; expenseId?: string; direct?: string }>();
  const router = useRouter();
  const {
    trips, history, saveTripExpenseDirectly, deleteHistory,
    expenseCategories, addExpenseCategory, removeExpenseCategory, defaultCurrency,
  } = useSplitStore();

  const myName = useMyName();
  const trip = trips.find((t) => t.id === tripId);
  const tripPeople = sortWithMeFirst(trip?.people ?? [], myName);
  const tripCurrencies = trip?.currencies ?? (trip?.currency ? [trip.currency] : [defaultCurrency]);

  // Default to user's preferred currency if it's in the trip's list, otherwise first trip currency
  const initialCurrency = tripCurrencies.includes(defaultCurrency) ? defaultCurrency : (tripCurrencies[0] ?? defaultCurrency);

  const today = fmtDate(new Date());

  const [expenseName, setExpenseName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [catDropY, setCatDropY] = useState(0);
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const catCardRef = useRef<View>(null);
  const [expenseCurrency, setExpenseCurrency] = useState<string>(initialCurrency);
  const [expCurrencyOpen, setExpCurrencyOpen] = useState(false);
  const [expCurrencyDropPos, setExpCurrencyDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const expCurrencyBtnRef = useRef<View>(null);
  const [amountText, setAmountText] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [participants, setParticipants] = useState<string[]>(tripPeople);
  const [paidByName, setPaidByName] = useState<string | null>(tripPeople[0] ?? null);
  const [receiptUri, setReceiptUri] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Reset form when navigating to a new expense (guards against stale state from previous visit)
  useFocusEffect(useCallback(() => {
    if (!expenseId) {
      setExpenseName('');
      setAmountText('');
      setCategory(null);
      setStartDate(fmtDate(new Date()));
      setEndDate('');
      setParticipants(tripPeople);
      setPaidByName(tripPeople[0] ?? null);
      setExpenseCurrency(initialCurrency);
      setReceiptUri(undefined);
    }
  }, [expenseId]));

  useEffect(() => {
    if (!expenseId) return;
    const record = history.find((r) => r.id === expenseId);
    if (!record) return;
    setExpenseName(record.restaurantName ?? '');
    setStartDate(record.receiptDate ?? today);
    setCategory(record.expenseCategory ?? null);
    setAmountText(record.total > 0 ? String(record.total) : '');
    setParticipants(record.people);
    setPaidByName(record.paidByName ?? null);
    if (record.currency) setExpenseCurrency(record.currency);
    setReceiptUri(record.imageUri);
  }, []);

  const pickReceiptImage = async (fromCamera: boolean) => {
    lightHaptic();
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setReceiptUri(result.assets[0].uri);
  };

  const handleAttachReceipt = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) pickReceiptImage(true);
          else if (idx === 2) pickReceiptImage(false);
        },
      );
    } else if (Platform.OS === 'android') {
      Alert.alert('Attach receipt', undefined, [
        { text: 'Take Photo', onPress: () => pickReceiptImage(true) },
        { text: 'Choose from Library', onPress: () => pickReceiptImage(false) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      pickReceiptImage(false);
    }
  };

  const amount = parseFloat(amountText) || 0;

  // Per-day / per-person calculation
  const dayCount = (() => {
    if (!endDate) return 0;
    const st = parseDisplay(startDate);
    const en = parseDisplay(endDate);
    if (isNaN(st.getTime()) || isNaN(en.getTime())) return 0;
    const diff = Math.round((en.getTime() - st.getTime()) / 86400000) + 1;
    return diff > 1 ? diff : 0;
  })();
  const perDay = dayCount > 0 && amount > 0 ? amount / dayCount : 0;
  const perPersonPerDay = dayCount > 0 && amount > 0 && participants.length > 0
    ? amount / (dayCount * participants.length) : 0;

  const filteredCats = catFilter.trim()
    ? expenseCategories.filter((c) => c.toLowerCase().includes(catFilter.toLowerCase()))
    : expenseCategories;

  const handleCatSubmit = () => {
    const t = catFilter.trim(); if (!t) return;
    const existing = expenseCategories.find((c) => c.toLowerCase() === t.toLowerCase());
    setCategory(existing ?? t);
    if (!existing) addExpenseCategory(t);
    setCatOpen(false); setCatFilter('');
  };

  const toggleParticipant = (name: string) => {
    selectionHaptic();
    setParticipants((prev) => {
      const next = prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name];
      if (paidByName && !next.includes(paidByName)) setPaidByName(next[0] ?? null);
      return next;
    });
  };

  const goBack = () => router.replace({ pathname: '/trip/expenses', params: { tripId: tripId! } } as any);

  const handleSave = () => {
    if (!expenseName.trim()) { setError('Enter an expense name.'); return; }
    if (!amount || amount <= 0) { setError('Enter an amount.'); return; }
    if (participants.length === 0) { setError('Select at least one participant.'); return; }
    setError(null);
    mediumHaptic();
    if (expenseId) deleteHistory(expenseId);
    saveTripExpenseDirectly({
      name: expenseName.trim(),
      receiptDate: startDate,
      category,
      rawItems: [{ name: expenseName.trim(), price: amount, quantity: 1 }],
      participants,
      paidByName,
      tripId: tripId!,
      currency: expenseCurrency,
      imageUri: receiptUri,
    });
    goBack();
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: expenseId ? (expenseName || 'Expense') : 'Add expense',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        headerLeft: () => (
          <CircleIconButton variant="back" size={28} color={C.primary} onPress={goBack} style={{ paddingHorizontal: 12 }} />
        ),
      }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* -- Name -- */}
          <FieldLabel>NAME</FieldLabel>
          <Card padding={0} row={false} radius={10} style={{ marginBottom: 8 }}>
            <View style={s.detailRow}>
              <TextInput
                style={[s.detailInput, { outlineWidth: 0 } as any]}
                value={expenseName}
                onChangeText={(v) => { setExpenseName(v); setError(null); }}
                placeholder="Expense name"
                placeholderTextColor={C.textDim}
                returnKeyType="next"
              />
            </View>
          </Card>

          {/* -- Category -- */}
          <FieldLabel style={{ marginTop: 12 }}>CATEGORY</FieldLabel>
          <View ref={catCardRef}>
            <Card padding={0} row={false} radius={10} style={{ marginBottom: 8 }}>
              <PressBtn style={s.detailRow} onPress={() => {
                if (catOpen) { setCatOpen(false); setCatFilter(''); return; }
                setCatFilter('');
                if (catCardRef.current) {
                  catCardRef.current.measureInWindow((_x, y, _w, h) => {
                    setCatDropY(y + h + 4);
                    setCatOpen(true);
                  });
                } else {
                  setCatOpen(true);
                }
              }} activeOpacity={0.7}>
                <Text style={[s.detailText, !category && { color: C.textDim }, { flex: 1 }]} numberOfLines={1}>
                  {category ?? 'Select category'}
                </Text>
                {catOpen
                  ? <ChevronUpCircleIcon color={C.text} size={15} />
                  : <ChevronDownCircleIcon color={C.text} size={15} />}
              </PressBtn>
            </Card>
          </View>

          {/* -- Amount -- */}
          <FieldLabel style={{ marginTop: 12 }}>AMOUNT</FieldLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Card padding={0} row={false} radius={10} style={[s.moneyCardBorder, { flex: 1 }, amountFocused && s.moneyCardFocused]}>
              <View style={[s.amountRow, { gap: 4 }]}>
                <Text style={s.moneyPrefix}>{getCurrencySymbol(expenseCurrency)}</Text>
                <TextInput
                  style={[s.detailInput, { flex: 1, outlineWidth: 0 } as any]}
                  value={amountText}
                  onChangeText={(v) => setAmountText(sanitizeNumberInput(v))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={C.textDim}
                  onFocus={() => setAmountFocused(true)}
                  onBlur={() => setAmountFocused(false)}
                />
              </View>
            </Card>
            {tripCurrencies.length > 1 && (
              <Card padding={0} row={false} radius={10} style={{ width: 92 }}>
                <PressBtn
                  ref={expCurrencyBtnRef}
                  style={[s.amountRow, { paddingHorizontal: 10 }]}
                  onPress={() => {
                    selectionHaptic();
                    if (expCurrencyBtnRef.current) {
                      expCurrencyBtnRef.current.measureInWindow((x, y, w, h) => {
                        setExpCurrencyDropPos({ top: y + h + 4, left: x, width: w });
                        setExpCurrencyOpen(true);
                      });
                    } else {
                      setExpCurrencyOpen((o) => !o);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.detailText, { flex: 1 }]} numberOfLines={1}>{expenseCurrency}</Text>
                  {expCurrencyOpen
                    ? <ChevronUpCircleIcon color={C.text} size={13} />
                    : <ChevronDownCircleIcon color={C.text} size={13} />}
                </PressBtn>
              </Card>
            )}
          </View>
          <Dropdown visible={expCurrencyOpen} position={expCurrencyDropPos} onClose={() => setExpCurrencyOpen(false)}>
            {tripCurrencies.map((code, i) => (
              <DropdownRow
                key={code}
                onPress={() => { selectionHaptic(); setExpenseCurrency(code); setExpCurrencyOpen(false); }}
                divider={i > 0}
                trailing={expenseCurrency === code ? <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" /> : undefined}
              >
                <Text style={s.detailText}>{getCurrencySymbol(code)} {code}</Text>
              </DropdownRow>
            ))}
          </Dropdown>

          <FieldLabel style={{ marginTop: 20 }}>DATES</FieldLabel>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Card padding={0} row={false} radius={10} style={{ flex: 1 }}>
              <DateRow value={startDate} onChange={setStartDate} placeholder="Start date" />
            </Card>
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <SortIcon size={13} color={C.textDim} />
            </View>
            <Card padding={0} row={false} radius={10} style={{ flex: 1 }}>
              <DateRow value={endDate} onChange={setEndDate} placeholder="End (optional)" />
            </Card>
          </View>

          {/* Per-day/person breakdown */}
          {dayCount > 0 && amount > 0 && (
            <View style={s.perDayBanner}>
              <Text style={s.perDayItem}><Text style={s.perDayVal}>{dayCount}</Text> days</Text>
              <View style={s.perDayDot} />
              <Text style={s.perDayItem}><Text style={s.perDayVal}>{fmt(perDay)}</Text>/day</Text>
              {perPersonPerDay > 0 && (
                <>
                  <View style={s.perDayDot} />
                  <Text style={s.perDayItem}><Text style={s.perDayVal}>{fmt(perPersonPerDay)}</Text>/person/day</Text>
                </>
              )}
            </View>
          )}

          {/* -- Participants -- */}
          {tripPeople.length > 0 && (
            <>
              <FieldLabel style={{ marginTop: 20 }}>
                {`FRIENDS${participants.length > 0 ? `  (${participants.length})` : ''}`}
              </FieldLabel>
              <View style={s.chipsWrap}>
                {tripPeople.map((name, i) => (
                  <PersonChip key={name} name={name} index={i} selected={participants.includes(name)} onPress={() => toggleParticipant(name)} />
                ))}
              </View>
            </>
          )}

          {/* -- Who paid -- */}
          {participants.length > 0 && (
            <>
              <FieldLabel style={{ marginTop: 20 }}>WHO PAID?</FieldLabel>
              <View style={s.chipsWrap}>
                {participants.map((name, i) => {
                  const idx = tripPeople.indexOf(name);
                  return (
                    <PersonChip
                      key={name}
                      name={name}
                      index={idx >= 0 ? idx : i}
                      selected={paidByName === name}
                      onPress={() => { selectionHaptic(); setPaidByName(name); }}
                    />
                  );
                })}
              </View>
            </>
          )}

          {tripPeople.length === 0 && (
            <View style={s.noParticipantsNote}>
              <MaterialCommunityIcons name="information-outline" size={14} color={C.textDim} />
              <Text style={s.noParticipantsText}>Add friends to this trip to track who paid for each expense.</Text>
            </View>
          )}

          {/* -- Receipt attachment -- */}
          {receiptUri ? (
            <View style={{ marginTop: 20 }}>
              <PressBtn onPress={handleAttachReceipt} activeOpacity={0.85}>
                <Image source={{ uri: receiptUri }} style={s.receiptThumb} resizeMode="cover" />
              </PressBtn>
              <PressBtn style={s.receiptRemoveBtn} onPress={() => { lightHaptic(); setReceiptUri(undefined); }} hitSlop={8}>
                <XMarkIcon size={13} color={C.white} />
                <Text style={s.receiptRemoveText}>Remove</Text>
              </PressBtn>
            </View>
          ) : (
            <PressBtn style={s.receiptDropZone} onPress={handleAttachReceipt} activeOpacity={0.7} noShadow>
              <CameraIcon size={26} color={C.textSub} />
              <Text style={s.receiptDropText}>Attach receipt</Text>
            </PressBtn>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
        <LinearGradient colors={[`${C.bg}00`, C.bg]} pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28 }} />
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        <View style={s.footer}>
          {expenseId && (
            <Button
              variant="destructive"
              size="big"
              style={{ flex: 1 }}
              label="Delete"
              icon={<TrashIcon size={18} color={C.text} />}
              onPress={() => { mediumHaptic(); deleteHistory(expenseId); goBack(); }}
            />
          )}
          <Button
            variant="primary"
            size="big"
            style={{ flex: 1 }}
            label={expenseId ? 'Update expense' : 'Save expense'}
            icon={<CheckCircleIcon size={18} color={C.text} />}
            onPress={handleSave}
          />
        </View>
      </KeyboardAvoidingView>

      <CategoryRenameModal cat={renamingCat} onClose={() => setRenamingCat(null)} />

      {/* Category dropdown — anchored below category card */}
      <Dropdown
        visible={catOpen}
        position={{ top: catDropY, left: 16, right: 16 }}
        onClose={() => { setCatOpen(false); setCatFilter(''); }}
        scroll={false}
        style={{ paddingHorizontal: 14, paddingBottom: 6 }}
      >
        <View style={s.catFilterRow}>
          <SearchIcon color={C.text} size={14} />
          <TextInput
            style={[s.catFilterInput, { outlineWidth: 0, outlineStyle: 'none' } as any]}
            value={catFilter}
            onChangeText={setCatFilter}
            placeholder="Search or create…"
            placeholderTextColor={C.textDim}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCatSubmit}
          />
          {catFilter.length > 0 && (
            <PressBtn onPress={() => setCatFilter('')} hitSlop={8}>
              <CloseCircleIcon size={15} color={C.textDim} />
            </PressBtn>
          )}
        </View>
        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.catOption}>
            <PressBtn style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              onPress={() => { setCategory(null); setCatOpen(false); setCatFilter(''); }} activeOpacity={0.7}>
              <Text style={[s.catOptionText, !category && { color: C.primary, fontFamily: 'Poppins_600SemiBold' }]}>None</Text>
              {!category && <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" />}
            </PressBtn>
          </View>
          {filteredCats.map((cat) => (
            <View key={cat} style={s.catOption}>
              <PressBtn style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                onPress={() => { selectionHaptic(); setCategory(cat); setCatOpen(false); setCatFilter(''); }} activeOpacity={0.7}>
                <Text style={[s.catOptionText, category === cat && { color: C.primary, fontFamily: 'Poppins_600SemiBold' }]}>{cat}</Text>
                {category === cat && <CheckCircleIcon size={15} color={C.text} filled fillColor="#F7D76A" />}
              </PressBtn>
              <PressBtn onPress={() => { setCatOpen(false); setCatFilter(''); setRenamingCat(cat); }} hitSlop={10} activeOpacity={0.7}>
                <PencilIcon color={C.textDim} size={14} />
              </PressBtn>
              <PressBtn onPress={() => { lightHaptic(); removeExpenseCategory(cat); if (category === cat) setCategory(null); }} hitSlop={10} activeOpacity={0.7}>
                <XMarkIcon size={14} color={C.error} />
              </PressBtn>
            </View>
          ))}
          {catFilter.trim().length > 0 && !filteredCats.find((c) => c.toLowerCase() === catFilter.toLowerCase()) && (
            <PressBtn style={s.catCreateRow} onPress={handleCatSubmit} activeOpacity={0.7}>
              <PlusCircleIcon color={C.primary} size={15} />
              <Text style={s.catCreateText}>Create "{catFilter.trim()}"</Text>
            </PressBtn>
          )}
        </ScrollView>
      </Dropdown>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 16 },

  // Receipt attachment
  receiptDropZone: {
    marginTop: 20, alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: InputMetrics.radius,
    paddingVertical: 28, backgroundColor: C.card,
  },
  receiptDropText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.textSub },
  receiptThumb: { width: '100%', height: 160, borderRadius: 12, backgroundColor: C.card },
  receiptRemoveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: 8, backgroundColor: C.error, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  receiptRemoveText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: C.white },

  separator: { height: 1, backgroundColor: C.border },

  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: InputMetrics.height,
  },
  detailInput: {
    flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, padding: 0,
  },
  detailText: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text },
  moneyPrefix: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.textSub },
  moneyCardBorder: { borderWidth: 1.5, borderColor: 'transparent' },
  moneyCardFocused: { borderColor: C.text },

  // Category dropdown
  catFilterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  catFilterInput: {
    flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, padding: 0,
  },
  catOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  catOptionText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  catCreateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  catCreateText: { fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.primary },

  // Dates inline row
  datesRow: { flexDirection: 'row', alignItems: 'stretch' },
  datesDivider: { width: 1, backgroundColor: C.border },

  // Amount row (inside card)
  amountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: InputMetrics.height,
  },

  // Per-day banner
  perDayBanner: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    marginTop: 10, padding: 12, borderRadius: 10,
    backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary + '30',
  },
  perDayItem: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.text },
  perDayVal: { fontFamily: 'Poppins_900Black', fontSize: 15, color: C.primary },
  perDayDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.textDim },

  // Participants / who paid
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  noParticipantsNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 16, paddingHorizontal: 4 },
  noParticipantsText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textDim, lineHeight: 18 },

  // Footer
  errorText: { color: C.error, textAlign: 'center', fontSize: 13, fontFamily: 'Poppins_400Regular', paddingHorizontal: 16, paddingBottom: 4 },
  footer: { padding: 16, paddingTop: 8, flexDirection: 'row', gap: 10 },

  // Category rename modal
  modalTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: C.text },
  catEditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  catEditText: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, flex: 1 },
  catEditInput: { fontFamily: 'Poppins_400Regular', fontSize: 15 },
  newCatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  newCatInput: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text, padding: 0 },
  newCatBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  renameNote: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textSub, lineHeight: 18 },
});
