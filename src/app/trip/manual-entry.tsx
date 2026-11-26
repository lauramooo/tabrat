import { PressBtn } from '@/components/PressBtn';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, Pressable } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, CenteredModal, CircleIconButton, DateRangeField, Dropdown, DropdownRow, FieldLabel, Input, KeyboardAwareScrollView } from '@/components/design';
import { CameraIcon, CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, CloseCircleIcon, GiftIcon, PencilIcon, PlusCircleIcon, SearchIcon, TrashIcon, XMarkIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics, Radius } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { fmt, getCurrencySymbol, sanitizeNumberInput, splitWithGifts } from '@/utils/calculator';
import { fmtDate, parseLocalDate } from '@/utils/date';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import { applyTextShortcuts } from '@/utils/text';
import { Text, TextInput } from '@/components/design/Text';

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
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
        <Button variant="primary" size="small" label="Save" onPress={handleSave} />
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
  const [catFilterFocused, setCatFilterFocused] = useState(false);
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
  // Gift split: `covered` participants owe nothing; `coveredBy` split their shares.
  const [covered, setCovered] = useState<string[]>([]);
  const [coveredBy, setCoveredBy] = useState<string[]>([]);
  const [giftOpen, setGiftOpen] = useState(false);
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
      setCovered([]);
      setCoveredBy([]);
      setGiftOpen(false);
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
    setEndDate(record.receiptEndDate ?? '');
    setCategory(record.expenseCategory ?? null);
    setAmountText(record.total > 0 ? String(record.total) : '');
    setParticipants(record.people);
    setPaidByName(record.paidByName ?? null);
    setCovered(record.coveredPeople ?? []);
    setCoveredBy(record.coveredBy ?? []);
    setGiftOpen(!!record.coveredPeople?.length);
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
    const st = parseLocalDate(startDate);
    const en = parseLocalDate(endDate);
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
    // paidByName is intentionally independent of participants — someone can pay without
    // splitting the cost themselves, so removing them as a participant shouldn't clear them
    // as the payer.
    setParticipants((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
    // Someone no longer on the expense can't be treated or be treating anyone on it.
    setCovered((prev) => prev.filter((p) => p !== name));
    setCoveredBy((prev) => prev.filter((p) => p !== name));
  };

  const toggleCovered = (name: string) => {
    selectionHaptic();
    const next = covered.includes(name) ? covered.filter((p) => p !== name) : [...covered, name];
    setCovered(next);
    const stillCovering = coveredBy.filter((p) => !next.includes(p));
    // First person treated: start with whoever paid as the one covering, if they can be.
    if (next.length > 0 && stillCovering.length === 0 && paidByName && participants.includes(paidByName) && !next.includes(paidByName)) {
      setCoveredBy([paidByName]);
    } else {
      setCoveredBy(stillCovering);
    }
    setError(null);
  };

  const toggleCoveredBy = (name: string) => {
    selectionHaptic();
    setCoveredBy((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
    setError(null);
  };

  // Deliberately always lands on the trip's home page rather than popping back to whatever
  // pushed this screen (the expenses list, a specific expense, trip detail's quick-add) — the
  // desired behavior here is "leaving this screen always returns to the trip," not "retrace my
  // steps." replace (not push) so it doesn't grow the stack every time this screen is used.
  // Every entry point pushes this screen, so pop back to wherever it was opened from (the trip's
  // Dashboard or Expenses tab) — a replace slid a new copy of the dashboard in like a forward
  // navigation. The replace is only a fallback if there's no history (e.g. a cold deep link).
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/trip/[id]', params: { id: tripId! } } as any);
  };

  const handleSave = () => {
    if (!expenseName.trim()) { setError('Enter an expense name.'); return; }
    if (!amount || amount <= 0) { setError('Enter an amount.'); return; }
    if (participants.length === 0) { setError('Select at least one participant.'); return; }
    if (covered.length > 0 && coveredBy.length === 0) { setError("Pick who's covering the people being treated."); return; }
    setError(null);
    mediumHaptic();
    if (expenseId) deleteHistory(expenseId);
    saveTripExpenseDirectly({
      name: expenseName.trim(),
      receiptDate: startDate,
      receiptEndDate: endDate || undefined,
      category,
      rawItems: [{ name: expenseName.trim(), price: amount, quantity: 1 }],
      participants,
      paidByName,
      tripId: tripId!,
      currency: expenseCurrency,
      imageUri: receiptUri,
      coveredPeople: covered,
      coveredBy,
    });
    goBack();
  };

  return (
    // A centered pop-up (same look as CenteredModal) rather than a full page: this route is a
    // transparentModal, so the trip stays visible behind the backdrop. Tapping the backdrop closes it.
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={goBack} />
      <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle} numberOfLines={1}>{expenseId ? (expenseName || 'Expense') : 'Add expense'}</Text>
        <CircleIconButton variant="close" size={22} color={C.text} onPress={goBack} />
      </View>

      <View style={{ flexShrink: 1 }}>
        <View style={{ flexShrink: 1, position: 'relative' }}>
        <KeyboardAwareScrollView style={s.scroll} contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* -- Name -- */}
          <FieldLabel>NAME</FieldLabel>
          <Card padding={0} row={false} radius={10} style={{ marginBottom: 8 }}>
            <View style={s.detailRow}>
              <TextInput
                style={[s.detailInput, { outlineWidth: 0 } as any]}
                value={expenseName}
                onChangeText={(v) => { setExpenseName(applyTextShortcuts(v)); setError(null); }}
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
                        // This button is only 92px wide (just enough for "USD"), but the dropdown
                        // rows show a symbol + code ("$ USD") — reusing the button's own width
                        // wrapped every row onto two lines. Widen it, anchored to the button's
                        // right edge so it doesn't run off-screen.
                        const width = Math.max(w, 160);
                        setExpCurrencyDropPos({ top: y + h + 4, left: Math.max(0, x + w - width), width });
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
                trailing={expenseCurrency === code ? <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} /> : undefined}
              >
                <Text style={s.detailText}>{getCurrencySymbol(code)} {code}</Text>
              </DropdownRow>
            ))}
          </Dropdown>

          <FieldLabel style={{ marginTop: 20 }}>DATES</FieldLabel>
          <DateRangeField
            startDate={startDate}
            endDate={endDate}
            onChange={(st, en) => { setStartDate(st); setEndDate(en); }}
            clearable={false}
          />

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
                {`RATS${participants.length > 0 ? `  (${participants.length})` : ''}`}
              </FieldLabel>
              <View style={s.chipsWrap}>
                {tripPeople.map((name, i) => (
                  <PersonChip key={name} name={name} index={i} selected={participants.includes(name)} onPress={() => toggleParticipant(name)} />
                ))}
              </View>
            </>
          )}

          {/* -- Who paid -- shows everyone on the trip, not just participants: someone can cover
              an expense they didn't personally share in (e.g. paying for a group activity they
              skipped), so the payer isn't restricted to the participant list. */}
          {tripPeople.length > 0 && (
            <>
              <FieldLabel style={{ marginTop: 20 }}>WHO PAID?</FieldLabel>
              <View style={s.chipsWrap}>
                {tripPeople.map((name, i) => (
                  <PersonChip
                    key={name}
                    name={name}
                    index={i}
                    selected={paidByName === name}
                    onPress={() => { selectionHaptic(); setPaidByName(name); }}
                  />
                ))}
              </View>
            </>
          )}

          {/* -- Gifts -- hidden behind "Was any of this a gift?": some participants are being
              treated, and others split their shares (e.g. Mom and Laura cover Ruben's and Leidy's
              tickets). Collapsing it clears the picks, so a hidden section never changes the split. */}
          {participants.length > 1 && (
            <>
              <PressBtn style={s.giftToggle} onPress={() => { selectionHaptic(); if (giftOpen) { setCovered([]); setCoveredBy([]); } setGiftOpen(!giftOpen); }} activeOpacity={0.7} noShadow>
                <GiftIcon size={14} color={C.textSub} />
                <Text style={s.giftToggleText}>Was any of this a gift?</Text>
                {giftOpen ? <ChevronUpCircleIcon size={15} color={C.textSub} /> : <ChevronDownCircleIcon size={15} color={C.textSub} />}
              </PressBtn>
              {giftOpen && (
                <>
                  <FieldLabel style={{ marginTop: 12 }}>{"WHO'S BEING TREATED?"}</FieldLabel>
                  <Text style={s.hintText}>{"They won't owe anything."}</Text>
                  <View style={s.chipsWrap}>
                    {participants.map((name) => (
                      <PersonChip key={name} name={name} index={tripPeople.indexOf(name)} selected={covered.includes(name)} onPress={() => toggleCovered(name)} />
                    ))}
                  </View>
                  {covered.length > 0 && (
                    <>
                      <FieldLabel style={{ marginTop: 16 }}>{"WHO'S COVERING THEM?"}</FieldLabel>
                      <View style={s.chipsWrap}>
                        {participants.filter((name) => !covered.includes(name)).map((name) => (
                          <PersonChip key={name} name={name} index={tripPeople.indexOf(name)} selected={coveredBy.includes(name)} onPress={() => toggleCoveredBy(name)} />
                        ))}
                      </View>
                      {amount > 0 && coveredBy.length > 0 && (
                        <View style={s.perDayBanner}>
                          {splitWithGifts(amount, participants, covered, coveredBy).map(({ name, amount: owed }, i) => (
                            <Text key={name} style={s.perDayItem}>
                              {i > 0 ? '·  ' : ''}{name} <Text style={s.perDayVal}>{covered.includes(name) ? 'gift' : fmt(owed, expenseCurrency)}</Text>
                            </Text>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tripPeople.length === 0 && (
            <View style={s.noParticipantsNote}>
              <MaterialCommunityIcons name="information-outline" size={14} color={C.textDim} />
              <Text style={s.noParticipantsText}>Add rats to this trip to track who paid for each expense.</Text>
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
        </KeyboardAwareScrollView>
        <LinearGradient colors={[`${C.bg}00`, C.bg]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, pointerEvents: 'none' }} />
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
      </View>

      <CategoryRenameModal cat={renamingCat} onClose={() => setRenamingCat(null)} />

      {/* Category dropdown — anchored below category card */}
      <Dropdown
        visible={catOpen}
        position={{ top: catDropY, left: 16, right: 16 }}
        onClose={() => { setCatOpen(false); setCatFilter(''); }}
        scroll={false}
        style={{ paddingHorizontal: 14, paddingBottom: 6 }}
      >
        <View style={[s.catFilterRow, catFilterFocused && s.catFilterRowFocused]}>
          <SearchIcon color={C.text} size={14} />
          <TextInput
            style={[s.catFilterInput, { outlineWidth: 0, outlineStyle: 'none' } as any]}
            value={catFilter}
            onChangeText={setCatFilter}
            onFocus={() => setCatFilterFocused(true)}
            onBlur={() => setCatFilterFocused(false)}
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
              {!category && <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} />}
            </PressBtn>
          </View>
          {filteredCats.map((cat) => (
            <View key={cat} style={s.catOption}>
              <PressBtn style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                onPress={() => { selectionHaptic(); setCategory(cat); setCatOpen(false); setCatFilter(''); }} activeOpacity={0.7}>
                <Text style={[s.catOptionText, category === cat && { color: C.primary, fontFamily: 'Poppins_600SemiBold' }]}>{cat}</Text>
                {category === cat && <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} />}
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
              <PlusCircleIcon color={C.primary} size={15} strokeWidth={1.8} />
              <Text style={s.catCreateText}>Create "{catFilter.trim()}"</Text>
            </PressBtn>
          )}
        </ScrollView>
      </Dropdown>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: C.bg, width: '100%', maxWidth: 420, maxHeight: '88%', borderRadius: Radius.xl, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  cardTitle: { ...Type.h2, color: C.text, flex: 1, lineHeight: 30 },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  // Receipt attachment
  receiptDropZone: {
    marginTop: 20, alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: InputMetrics.radius,
    paddingVertical: 28, backgroundColor: C.card,
  },
  receiptDropText: { ...Type.labelMedium, color: C.textSub },
  receiptThumb: { width: '100%', height: 160, borderRadius: 12, backgroundColor: C.card },
  receiptRemoveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: 8, backgroundColor: C.error, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  receiptRemoveText: { ...Type.pillLabel, color: C.white },

  separator: { height: 1, backgroundColor: C.border },

  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: InputMetrics.height,
  },
  detailInput: {
    flex: 1, minWidth: 0, ...Type.bodySmall, color: C.text, padding: 0,
  },
  detailText: { ...Type.bodySmall, color: C.text },
  moneyPrefix: { ...Type.bodySmall, color: C.textSub },
  moneyCardBorder: { borderWidth: 1.5, borderColor: 'transparent' },
  moneyCardFocused: { borderColor: C.text },

  // Category dropdown
  catFilterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  catFilterRowFocused: { borderBottomColor: C.text },
  catFilterInput: {
    flex: 1, minWidth: 0, ...Type.bodySmall, color: C.text, padding: 0,
  },
  catOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  catOptionText: { ...Type.labelMedium, color: C.text },
  catCreateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  catCreateText: { ...Type.labelMedium, color: C.primary },

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
  perDayItem: { ...Type.cardDesc, color: C.text },
  perDayVal: { fontFamily: 'Poppins_900Black', fontSize: 15, color: C.primary },
  perDayDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.textDim },

  // Participants / who paid
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  noParticipantsNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 16, paddingHorizontal: 4 },
  giftToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 16, paddingVertical: 4 },
  giftToggleText: { ...Type.cardDesc, color: C.textSub, textDecorationLine: 'underline' },
  hintText: { ...Type.cardDesc, color: C.textSub, marginBottom: 8 },
  noParticipantsText: { flex: 1, ...Type.cardDesc, color: C.textDim, lineHeight: 18 },

  // Footer
  errorText: { color: C.error, textAlign: 'center', ...Type.cardDesc, paddingHorizontal: 16, paddingBottom: 4 },
  footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8, flexDirection: 'row', gap: 10 },

  // Category rename modal
  modalTitle: { ...Type.cardTitle, color: C.text },
  catEditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  catEditText: { ...Type.bodySmall, color: C.text, flex: 1 },
  catEditInput: { ...Type.bodySmall },
  newCatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  newCatInput: { flex: 1, ...Type.labelMedium, color: C.text, padding: 0 },
  newCatBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  renameNote: { ...Type.cardDesc, color: C.textSub, lineHeight: 18 },
});
