import { PressBtn } from '@/components/PressBtn';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { BillHeader, FlowSteps } from '@/components/FlowSteps';
import { ChevronDownCircleIcon, ChevronUpCircleIcon, PlusCircleIcon, SearchIcon, TagIcon, UserIcon, UserMultipleIcon } from '@/components/FigmaIcons';
import { PersonChip } from '@/components/PersonChip';
import { Button, Dropdown, DropdownRow, FieldLabel } from '@/components/design';
import { C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { sortWithMeFirst } from '@/utils/sortPeople';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import type { Group } from '@/types';

export default function PeopleScreen() {
  const router = useRouter();
  const { people, groups, friends, addPerson, removePerson } = useSplitStore();
  const [friendSearch, setFriendSearch] = useState('');
  const [friendDropOpen, setFriendDropOpen] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [myName, setMyName] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const stored = Platform.OS === 'web'
          ? localStorage.getItem('profile_username')
          : await AsyncStorage.getItem('profile_username');
        if (stored) {
          setMyName(stored);
          if (!people.some((p) => p.name.toLowerCase() === stored.toLowerCase())) {
            addPerson(stored);
          }
        }
      } catch {}
    };
    load();
  }, []);

  const handleAdd = (nameToAdd?: string) => {
    const trimmed = (nameToAdd ?? friendSearch).trim();
    if (!trimmed) return;
    if (people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setDupError(`${trimmed} is already added.`);
      return;
    }
    setDupError(null);
    lightHaptic();
    addPerson(trimmed);
    setFriendSearch('');
    setFriendDropOpen(false);
  };

  const handleAddGroup = (group: Group) => {
    selectionHaptic();
    let added = 0;
    group.members.forEach((memberName) => {
      if (!people.some((p) => p.name.toLowerCase() === memberName.toLowerCase())) {
        addPerson(memberName);
        added++;
      }
    });
    setFriendSearch('');
    setFriendDropOpen(false);
    if (added === 0) setDupError(`Everyone in "${group.name}" is already added.`);
    else setDupError(null);
  };

  const handleNext = () => {
    if (people.length < 2) { setDupError('Add at least 2 friends to split the bill.'); return; }
    setDupError(null);
    mediumHaptic();
    router.replace('/assign');
  };

  const sortedPeople = sortWithMeFirst(people, myName);

  const manualPeople = people.filter(
    (p) => !friends.some((f) => f.name.toLowerCase() === p.name.toLowerCase()),
  );

  const q = friendSearch.toLowerCase().trim();
  const selectedNames = people.map((p) => p.name.toLowerCase());
  const filteredFriends = friends.filter(
    (f) => !selectedNames.includes(f.name.toLowerCase()) && (q ? f.name.toLowerCase().includes(q) : true),
  );
  const filteredGroups = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q))
    : groups;
  const showDrop = friendDropOpen && (filteredFriends.length > 0 || filteredGroups.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BillHeader />
      <FlowSteps active={1} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* -- Added people as chips -- */}
          {people.length > 0 && (
            <View style={styles.chipsSection}>
              <FieldLabel>{`SPLITTING WITH  (${people.length})`}</FieldLabel>
              <View style={styles.chipsWrap}>
                {sortedPeople.map((person, i) => {
                  const isMe = myName && person.name.toLowerCase() === myName.toLowerCase();
                  const fi = friends.findIndex((f) => f.name.toLowerCase() === person.name.toLowerCase());
                  const colorIdx = fi >= 0 ? fi : friends.length + manualPeople.findIndex((m) => m.id === person.id);
                  return (
                    <PersonChip
                      key={person.id}
                      name={isMe ? 'me' : person.name}
                      index={colorIdx}
                      removable
                      onPress={() => { selectionHaptic(); removePerson(person.id); setDupError(null); }}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* -- Search card with dropdown -- */}
          <View style={{ position: 'relative', zIndex: showDrop ? 20 : 0 }}>
            <View style={styles.card}>
              <View style={styles.searchRow}>
                <SearchIcon color={C.text} size={15} />
                <TextInput
                  style={[styles.searchInput, { outlineWidth: 0 } as any]}
                  value={friendSearch}
                  onChangeText={(t) => { setFriendSearch(t); setDupError(null); }}
                  onFocus={() => setFriendDropOpen(true)}
                  onBlur={() => setTimeout(() => setFriendDropOpen(false), 150)}
                  placeholder="Search friends or groups"
                  placeholderTextColor={C.textDim}
                  onSubmitEditing={() => handleAdd()}
                  returnKeyType="done"
                />
                {friendSearch.trim() ? (
                  <PressBtn onPress={() => handleAdd()} hitSlop={8} activeOpacity={0.7}>
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
            </View>
            <Dropdown mode="inline" visible={showDrop} position={{ top: InputMetrics.height + 6 }} onClose={() => setFriendDropOpen(false)}>
              {filteredFriends.map((f) => (
                <DropdownRow key={f.id} icon={<UserIcon size={15} color={C.textSub} />} onPress={() => { lightHaptic(); handleAdd(f.name); }}>
                  <Text style={styles.dropName}>{f.name}</Text>
                </DropdownRow>
              ))}
              {filteredGroups.map((g) => (
                <DropdownRow
                  key={g.id}
                  icon={<Text style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{g.icon}</Text>}
                  onPress={() => handleAddGroup(g)}
                >
                  <Text style={styles.dropName}>{g.name}</Text>
                  <Text style={styles.dropSub}>{g.members.length} members</Text>
                </DropdownRow>
              ))}
            </Dropdown>
          </View>

          {dupError ? <Text style={styles.errorText}>{dupError}</Text> : null}

          {people.length === 0 && !friendSearch && (
            <View style={styles.empty}>
              <UserMultipleIcon size={52} color={C.textDim} />
              <Text style={styles.emptyTitle}>Add friends to split with</Text>
              <Text style={styles.emptyText}>Add at least 2 people to continue</Text>
            </View>
          )}

        </ScrollView>

        <View style={styles.footer}>
          <Button
            variant={people.length < 2 ? 'inactive' : 'primary'}
            size="big"
            label="Assign Items"
            icon={<TagIcon color={C.text} size={18} />}
            onPress={handleNext}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },

  chipsSection: { gap: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  card: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: InputMetrics.height, gap: 10 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text },
  dropName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  dropSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textDim },

  errorText: { color: C.error, fontSize: 13, fontFamily: 'Poppins_400Regular' },
  empty: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: C.text },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub, textAlign: 'center' },

  footer: { padding: 16, paddingTop: 8 },
});
