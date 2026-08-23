import { PressBtn } from '@/components/PressBtn';
import { ChevronDownCircleIcon, ChevronUpCircleIcon, HomeTypeIcon, PlusCircleIcon, SearchIcon, UserIcon } from '@/components/FigmaIcons';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Platform, ScrollView, StyleSheet,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, Dropdown, DropdownRow, FieldLabel, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { PersonChip } from '@/components/PersonChip';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { sortWithMeFirst } from '@/utils/sortPeople';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

export default function NewHomeScreen() {
  const router = useRouter();
  const { addHome, friends, groups, defaultCurrency } = useSplitStore();

  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [myName, setMyName] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendDropOpen, setFriendDropOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = Platform.OS === 'web'
          ? localStorage.getItem('profile_username')
          : await AsyncStorage.getItem('profile_username');
        if (stored) { setMyName(stored); setMembers([stored]); }
      } catch {}
    };
    load();
  }, []);

  const addMember = (n?: string) => {
    const trimmed = (n ?? friendSearch).trim();
    if (!trimmed || members.includes(trimmed)) return;
    lightHaptic();
    setMembers((prev) => [...prev, trimmed]);
    setFriendSearch('');
    setFriendDropOpen(false);
  };

  const addGroupMembers = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    selectionHaptic();
    setMembers((prev) => {
      const toAdd = group.members.filter((m) => !prev.includes(m));
      return [...prev, ...toAdd];
    });
    setFriendSearch('');
    setFriendDropOpen(false);
  };

  const q = friendSearch.toLowerCase().trim();
  const filteredFriends = friends.filter(
    (f) => !members.includes(f.name) && (q ? f.name.toLowerCase().includes(q) : true),
  );
  const filteredGroups = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q))
    : groups;
  const showDrop = friendDropOpen && (filteredFriends.length > 0 || filteredGroups.length > 0);

  const handleCreate = () => {
    if (!name.trim()) { setError('Home name is required'); return; }
    mediumHaptic();
    const id = addHome(name.trim(), '', members, defaultCurrency ?? 'USD');
    router.replace({ pathname: '/home/[id]', params: { id } } as any);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'New home',
        headerBackTitle: '',
        headerTitleAlign: 'center',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        headerTitleStyle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text },
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
          placeholder="Our apartment"
          placeholderTextColor={C.textDim}
          autoFocus
        />

        {/* -- Members -- */}
        <FieldLabel>HOUSEMATES</FieldLabel>

        {members.length > 0 && (
          <View style={s.peopleChips}>
            {sortWithMeFirst(members, myName).map((m, i) => {
              const isMe = myName && m === myName;
              return (
                <PersonChip
                  key={m}
                  name={isMe ? 'me' : m}
                  index={i}
                  selected
                  removable
                  onPress={() => { lightHaptic(); setMembers((prev) => prev.filter((x) => x !== m)); }}
                />
              );
            })}
          </View>
        )}

        <View style={{ position: 'relative', zIndex: showDrop ? 20 : 0, marginBottom: 12 }}>
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
                onSubmitEditing={() => addMember()}
                returnKeyType="done"
              />
              {friendSearch.trim() ? (
                <PressBtn onPress={() => addMember()} hitSlop={8} activeOpacity={0.7}>
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
              <DropdownRow key={f.id} icon={<UserIcon size={15} color={C.textSub} />} onPress={() => addMember(f.name)}>
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

        {error && <Text style={s.errorText}>{error}</Text>}
      </ScrollView>

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          label="Create Home"
          icon={<HomeTypeIcon size={18} color={C.text} />}
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

  peopleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },

  friendsCard: { overflow: 'hidden' },
  friendSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: InputMetrics.height, gap: 10 },
  friendSearchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text },
  friendDropName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  friendDropSub: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textDim },

  errorText: { color: C.error, fontSize: 13, fontFamily: 'Poppins_400Regular', marginTop: 8 },

  footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
});
