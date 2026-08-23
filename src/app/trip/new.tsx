import DateTimePicker from '@react-native-community/datetimepicker';
import { PressBtn } from '@/components/PressBtn';
import { CalendarIcon, CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, CloseCircleIcon, MoneyIcon, PlusCircleIcon, SearchIcon, SortIcon, TripTypeIcon, UserIcon } from '@/components/FigmaIcons';
import { Stack, useRouter } from 'expo-router';
import { BillHeaderTitle } from '@/components/FlowSteps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement, useEffect, useRef, useState } from 'react';
import {
  Platform, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, DatePickerModal, Divider, Dropdown, DropdownRow, FieldLabel, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { sanitizeNumberInput } from '@/utils/calculator';
import { fmtDate } from '@/utils/date';
import { sortWithMeFirst } from '@/utils/sortPeople';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CHF', symbol: 'Fr' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'HKD', symbol: 'HK$' },
  { code: 'INR', symbol: '₹' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'KRW', symbol: '₩' },
  { code: 'AED', symbol: 'AED' },
];

function toInputDate(str: string): string {
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromInputDate(val: string): string {
  const formatted = fmtDate(val + 'T00:00:00');
  return formatted || val;
}
function parseDisplayDate(str: string): Date {
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function NewTripScreen() {
  const router = useRouter();
  const { addTrip, friends, groups, defaultCurrency } = useSplitStore();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currencies, setCurrencies] = useState<string[]>([defaultCurrency ?? 'USD']);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyDropPos, setCurrencyDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const currencyBtnRef = useRef<View>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [myName, setMyName] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendDropOpen, setFriendDropOpen] = useState(false);
  const [myBudget, setMyBudget] = useState('');
  const [groupBudget, setGroupBudget] = useState('');
  const [focusedMoneyField, setFocusedMoneyField] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = Platform.OS === 'web'
          ? localStorage.getItem('profile_username')
          : await AsyncStorage.getItem('profile_username');
        if (stored) { setMyName(stored); setPeople((prev) => prev.includes(stored) ? prev : [stored, ...prev]); }
      } catch {}
    };
    load();
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [iosPickerDate, setIosPickerDate] = useState(new Date());
  const openDatePicker = (field: 'start' | 'end') => {
    const existing = field === 'start' ? startDate : endDate;
    setIosPickerDate(existing ? parseDisplayDate(existing) : new Date());
    setShowDatePicker(field);
  };

  const onDateChange = (_: any, date?: Date) => {
    if (Platform.OS !== 'android') return;
    setShowDatePicker(null);
    if (date) {
      const formatted = fmtDate(date);
      if (showDatePicker === 'start') setStartDate(formatted);
      else setEndDate(formatted);
    }
  };

  const addPerson = (n?: string) => {
    const trimmed = (n ?? friendSearch).trim();
    if (!trimmed || people.includes(trimmed)) return;
    lightHaptic();
    setPeople((prev) => [...prev, trimmed]);
    setFriendSearch('');
    setFriendDropOpen(false);
  };

  const toggleCurrency = (code: string) => {
    selectionHaptic();
    setCurrencies((prev) => prev.includes(code) ? (prev.length > 1 ? prev.filter((c) => c !== code) : prev) : [...prev, code]);
  };

  const addGroupMembers = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    selectionHaptic();
    setPeople((prev) => {
      const toAdd = group.members.filter((m) => !prev.includes(m));
      return [...prev, ...toAdd];
    });
  };

  const q = friendSearch.toLowerCase().trim();
  const filteredFriends = friends.filter(
    (f) => !people.includes(f.name) && (q ? f.name.toLowerCase().includes(q) : true),
  );
  const filteredGroups = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q))
    : groups;
  const showDrop = friendDropOpen && (filteredFriends.length > 0 || filteredGroups.length > 0);
  const currencySymbol = CURRENCIES.find((c) => c.code === currencies[0])?.symbol ?? '$';

  const handleCreate = () => {
    if (!name.trim()) { setError('Trip name is required'); return; }
    mediumHaptic();
    const id = addTrip(
      name.trim(),
      '',
      startDate.trim(),
      people.length > 0 ? people : undefined,
      currencies[0] ?? 'USD',
      currencies,
      parseFloat(myBudget) > 0 ? parseFloat(myBudget) : undefined,
      parseFloat(groupBudget) > 0 ? parseFloat(groupBudget) : undefined,
    );
    router.replace({ pathname: '/trip/[id]', params: { id } } as any);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        headerTitleAlign: 'center',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        headerTitle: () => <BillHeaderTitle name={name.trim() || 'New trip'} date={startDate} endDate={endDate} />,
      }} />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* -- Name -- */}
        <FieldLabel>NAME</FieldLabel>
        <Input
          style={s.input}
          value={name}
          onChangeText={(v) => { setName(v); setError(null); }}
          placeholder="Summer Europe trip"
          placeholderTextColor={C.textDim}
          autoFocus
        />

        {/* -- Dates -- */}
        <FieldLabel>DATES</FieldLabel>
        <View style={s.dateRow}>
          {/* Start date */}
          <View style={{ flex: 1 }}>
            {Platform.OS === 'web' ? (
              <View style={[s.dateBtn, { position: 'relative' }]}>
                <CalendarIcon size={15} color={C.text} />
                <Text style={{ color: startDate ? C.text : C.textDim, flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 15 }}>{startDate || 'Start date'}</Text>
                {createElement('input', {
                  type: 'date',
                  value: toInputDate(startDate),
                  onChange: (e: any) => { const v = e.target.value; if (v) setStartDate(fromInputDate(v)); },
                  style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any,
                })}
              </View>
            ) : (
              <PressBtn style={s.dateBtn} onPress={() => openDatePicker('start')} activeOpacity={0.7}>
                <CalendarIcon size={15} color={C.text} />
                <Text style={{ color: startDate ? C.text : C.textDim, flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 15 }}>{startDate || 'Start date'}</Text>
                {startDate ? <PressBtn onPress={() => setStartDate('')} hitSlop={8}><CloseCircleIcon size={15} color={C.textDim} /></PressBtn> : null}
              </PressBtn>
            )}
          </View>

          <View style={{ height: InputMetrics.height, justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <SortIcon size={13} color={C.textDim} />
            </View>
          </View>

          {/* End date */}
          <View style={{ flex: 1 }}>
            {Platform.OS === 'web' ? (
              <View style={[s.dateBtn, { position: 'relative' }]}>
                <CalendarIcon size={15} color={C.text} />
                <Text style={{ color: endDate ? C.text : C.textDim, flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 15 }}>{endDate || 'End date'}</Text>
                {createElement('input', {
                  type: 'date',
                  value: toInputDate(endDate),
                  onChange: (e: any) => { const v = e.target.value; if (v) setEndDate(fromInputDate(v)); },
                  style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any,
                })}
              </View>
            ) : (
              <PressBtn style={s.dateBtn} onPress={() => openDatePicker('end')} activeOpacity={0.7}>
                <CalendarIcon size={15} color={C.text} />
                <Text style={{ color: endDate ? C.text : C.textDim, flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 15 }}>{endDate || 'End date'}</Text>
                {endDate ? <PressBtn onPress={() => setEndDate('')} hitSlop={8}><CloseCircleIcon size={15} color={C.textDim} /></PressBtn> : null}
              </PressBtn>
            )}
          </View>
        </View>

        {/* -- Friends -- */}
        <FieldLabel>FRIENDS</FieldLabel>

        {people.length > 0 && (
          <View style={s.peopleChips}>
            {sortWithMeFirst(people, myName).map((p, i) => {
              const isMe = myName && p === myName;
              return (
                <PersonChip
                  key={p}
                  name={isMe ? 'me' : p}
                  index={i}
                  selected
                  removable
                  onPress={() => { lightHaptic(); setPeople((prev) => prev.filter((x) => x !== p)); }}
                />
              );
            })}
          </View>
        )}

        <View style={{ position: 'relative', zIndex: showDrop ? 20 : 0, marginBottom: 20 }}>
          <Card padding={0} row={false} style={s.friendsCard}>
            <View style={s.friendSearchRow}>
              <SearchIcon color={C.text} size={15} />
              <TextInput
                style={[s.friendSearchInput, { outlineWidth: 0 } as any]}
                value={friendSearch}
                onChangeText={setFriendSearch}
                onFocus={() => setFriendDropOpen(true)}
                onBlur={() => setTimeout(() => setFriendDropOpen(false), 150)}
                placeholder="Search friends or groups"
                placeholderTextColor={C.textDim}
                onSubmitEditing={() => addPerson()}
                returnKeyType="done"
              />
              {friendSearch.trim() ? (
                <PressBtn onPress={() => addPerson()} hitSlop={8} activeOpacity={0.7}>
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
          <Dropdown mode="inline" visible={showDrop} position={{ top: InputMetrics.height + 4 }} onClose={() => setFriendDropOpen(false)}>
            {filteredFriends.map((f) => (
              <DropdownRow key={f.id} icon={<UserIcon size={15} color={C.textSub} />} onPress={() => addPerson(f.name)}>
                <Text style={s.friendDropName}>{f.name}</Text>
              </DropdownRow>
            ))}
            {filteredGroups.map((g) => (
              <DropdownRow
                key={g.id}
                icon={<Text style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{g.icon}</Text>}
                onPress={() => addGroupMembers(g.id)}
              >
                <Text style={s.friendDropName}>{g.name}</Text>
                <Text style={s.friendDropSub}>{g.members.length} members</Text>
              </DropdownRow>
            ))}
          </Dropdown>
        </View>

        {/* -- Currency -- */}
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

        {/* -- My budget -- */}
        <FieldLabel>MY BUDGET</FieldLabel>
        <Card padding={0} row={false} radius={10} style={[s.moneyCard, focusedMoneyField === 'myBudget' && s.moneyCardFocused]}>
          <View style={[s.editDateRow, { gap: 4 }]}>
            <Text style={s.moneyPrefix}>{currencySymbol}</Text>
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

        {/* -- Group budget -- */}
        <FieldLabel>GROUP BUDGET</FieldLabel>
        <Card padding={0} row={false} radius={10} style={[s.moneyCard, focusedMoneyField === 'groupBudget' && s.moneyCardFocused]}>
          <View style={[s.editDateRow, { gap: 4 }]}>
            <Text style={s.moneyPrefix}>{currencySymbol}</Text>
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

        {error && <Text style={s.errorText}>{error}</Text>}
      </ScrollView>

      {/* -- Android date picker (renders as dialog) -- */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={iosPickerDate}
          mode="date"
          display="calendar"
          onChange={onDateChange}
        />
      )}

      {/* -- iOS date picker modal -- */}
      {Platform.OS === 'ios' && (
        <>
          <DatePickerModal
            visible={showDatePicker === 'start'}
            value={iosPickerDate}
            onChange={(d) => setStartDate(fmtDate(d))}
            onClose={() => setShowDatePicker(null)}
            title="Start date"
          />
          <DatePickerModal
            visible={showDatePicker === 'end'}
            value={iosPickerDate}
            onChange={(d) => setEndDate(fmtDate(d))}
            onClose={() => setShowDatePicker(null)}
            title="End date"
          />
        </>
      )}

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Create Trip"
          icon={<TripTypeIcon color={C.text} size={18} />}
          onPress={handleCreate}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingTop: 16 },

  input: { marginBottom: 16 },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 14 },

  editDateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: InputMetrics.height },
  editDateText: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text },
  moneyPrefix: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.textSub },
  moneyCard: { marginBottom: 16, borderWidth: 1.5, borderColor: 'transparent' },
  moneyCardFocused: { borderColor: C.text },
  dropdownRowText: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },

  peopleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },

  friendsCard: { overflow: 'hidden' },
  friendSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: InputMetrics.height, gap: 10 },
  friendSearchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text },
  friendDropName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  friendDropSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textDim },

  errorText: { color: C.error, fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 8 },

  footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
});
