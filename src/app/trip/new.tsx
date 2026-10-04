import { PressBtn } from '@/components/PressBtn';
import { CalendarIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, CloseCircleIcon, MoneyIcon, PlusCircleIcon, TripTypeIcon, UserIcon } from '@/components/FigmaIcons';
import { Stack, useRouter } from 'expo-router';
import { ScreenHeaderTitle } from '@/components/FlowSteps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Platform, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, CurrencyPickerList, DateRangeCalendarModal, Divider, Dropdown, DropdownRow, FieldLabel, Input, SearchInput } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { CURRENCIES } from '@/constants/currencies';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { sanitizeNumberInput } from '@/utils/calculator';
import { fmtDateRange } from '@/utils/date';
import { sortWithMeFirst } from '@/utils/sortPeople';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

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
  const [addPressed, setAddPressed] = useState(false);
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
  const [dateModalOpen, setDateModalOpen] = useState(false);

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
        // No headerRight button here to compete for space with the title, unlike BillHeader/
        // trip[id]/home[id] — inline headerTitle is fine and keeps the header compact.
        headerTitle: () => <ScreenHeaderTitle name={name.trim() || 'New trip'} date={startDate} endDate={endDate} />,
      }} />
      {/* No KeyboardAvoidingView — it fights the ScrollView's own native "scroll the focused
          field into view" behavior on iOS and can collapse the whole scroll area to almost
          nothing when the keyboard opens (see manual-entry.tsx and AuthGate.tsx for the same
          failure mode and fix). */}
      <View style={{ flex: 1 }}>
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
        <PressBtn style={s.dateBtn} onPress={() => setDateModalOpen(true)} activeOpacity={0.7}>
          <CalendarIcon size={15} color={C.text} />
          <Text style={{ color: startDate ? C.text : C.textDim, flex: 1, ...Type.bodySmall }} numberOfLines={1}>
            {startDate ? fmtDateRange(startDate, endDate) : 'Choose date(s)'}
          </Text>
          {startDate ? (
            <PressBtn onPress={() => { setStartDate(''); setEndDate(''); }} hitSlop={8}>
              <CloseCircleIcon size={15} color={C.textDim} />
            </PressBtn>
          ) : null}
        </PressBtn>
        <DateRangeCalendarModal
          visible={dateModalOpen}
          startDate={startDate}
          endDate={endDate}
          onConfirm={(s, e) => { setStartDate(s); setEndDate(e); setDateModalOpen(false); }}
          onClose={() => setDateModalOpen(false)}
        />

        {/* -- Rats -- */}
        <FieldLabel>RATS</FieldLabel>

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
          <SearchInput
            value={friendSearch}
            onChangeText={setFriendSearch}
            onFocus={() => setFriendDropOpen(true)}
            onBlur={() => setTimeout(() => setFriendDropOpen(false), 150)}
            placeholder="Search rats or groups"
            onSubmitEditing={() => addPerson()}
            returnKeyType="done"
            trailing={friendSearch.trim() ? (
              <PressBtn
                onPress={() => addPerson()}
                onPressIn={() => setAddPressed(true)}
                onPressOut={() => setAddPressed(false)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <PlusCircleIcon color={C.primary} size={15} strokeWidth={1.8} filled={addPressed} />
              </PressBtn>
            ) : (
              <PressBtn onPress={() => setFriendDropOpen((o) => !o)} hitSlop={8} activeOpacity={0.7}>
                {friendDropOpen
                  ? <ChevronUpCircleIcon color={C.text} size={15} />
                  : <ChevronDownCircleIcon color={C.text} size={15} />}
              </PressBtn>
            )}
          />
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
                  // The dropdown needs room for "$  USD · US Dollar", which is wider than the
                  // compact currency button itself — using the button's own width made every row
                  // wrap to two lines. Widen it (anchored to the button's right edge so it doesn't
                  // run off-screen) rather than reusing that narrow measurement.
                  const width = Math.max(w, 280);
                  setCurrencyDropPos({ top: y + h + 4, left: Math.max(0, x + w - width), width });
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
        <Dropdown visible={currencyOpen} position={currencyDropPos} onClose={() => setCurrencyOpen(false)} scroll={false}>
          <CurrencyPickerList selected={currencies} onToggle={toggleCurrency} />
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

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Create Trip"
          icon={<TripTypeIcon color={C.text} size={18} />}
          onPress={handleCreate}
        />
      </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingTop: 16 },

  input: { marginBottom: 16 },

  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 14, marginBottom: 20 },

  editDateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: InputMetrics.height },
  editDateText: { flex: 1, minWidth: 0, ...Type.bodySmall, color: C.text },
  moneyPrefix: { ...Type.bodySmall, color: C.textSub },
  moneyCard: { marginBottom: 16, borderWidth: 1.5, borderColor: 'transparent' },
  moneyCardFocused: { borderColor: C.text },

  peopleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },

  friendDropName: { flex: 1, ...Type.labelMedium, color: C.text },
  friendDropSub: { ...Type.cardDesc, color: C.textDim },

  errorText: { color: C.error, ...Type.cardDesc, marginTop: 8 },

  footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
});
