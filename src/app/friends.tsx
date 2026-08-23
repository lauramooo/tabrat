import { Stack } from 'expo-router';
import { PressBtn } from '@/components/PressBtn';
import { Avatar } from '@/components/Avatar';
import { PencilIcon, PlusIcon, TrashIcon, UserIcon, UserMultipleIcon } from '@/components/FigmaIcons';
import { useMemo, useRef, useState } from 'react';
import {
  Animated, ScrollView, SectionList,
  StyleSheet, TextInput, View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, CenteredModal, FieldLabel, IconBadge, Input, SectionLabel } from '@/components/design';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { Radius, Spacing } from '@/constants/spacing';
import { Type } from '@/constants/typography';
import { useSplitStore } from '@/store/useSplitStore';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import type { Person } from '@/types';

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// -- Edit friend modal ---------------------------------------------------------

function EditFriendModal({ friend, onClose }: { friend: Person | null; onClose: () => void }) {
  const { updateFriend, groups, updateGroup } = useSplitStore();
  const [name, setName] = useState(friend?.name ?? '');
  const [addGroupId, setAddGroupId] = useState<string | null>(null);

  const handleSave = () => {
    if (!friend || !name.trim()) return;
    mediumHaptic();
    updateFriend(friend.id, name.trim());
    onClose();
  };

  const handleAddToGroup = (groupId: string) => {
    if (!friend) return;
    const grp = groups.find((g) => g.id === groupId);
    if (!grp) return;
    if (grp.members.includes(friend.name)) return;
    selectionHaptic();
    updateGroup(grp.id, grp.name, grp.icon, [...grp.members, friend.name]);
    setAddGroupId(groupId);
    setTimeout(() => setAddGroupId(null), 1500);
  };

  return (
    <CenteredModal visible={!!friend} onClose={onClose} title={<Text style={{ ...Type.h1, color: C.text }}>Edit friend</Text>}>
      <FieldLabel>NAME</FieldLabel>
      <Input
        style={s.input}
        value={name}
        onChangeText={setName}
        autoFocus
        placeholder="Friend's name"
        placeholderTextColor={C.textDim}
      />

      {groups.length > 0 && (
        <>
          <FieldLabel style={{ marginTop: 12 }}>ADD TO GROUP</FieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {groups.map((g) => {
              const inGroup = g.members.includes(friend?.name ?? '');
              const justAdded = addGroupId === g.id;
              return (
                <PressBtn key={g.id}
                  style={[s.groupChip, (inGroup || justAdded) && s.groupChipActive]}
                  onPress={() => handleAddToGroup(g.id)} activeOpacity={0.75}>
                  <UserMultipleIcon size={14} color={(inGroup || justAdded) ? C.primary : C.textSub} />
                  <Text style={[s.groupChipText, (inGroup || justAdded) && { color: C.primary }]}>
                    {justAdded ? 'Added!' : inGroup ? `In ${g.name}` : g.name}
                  </Text>
                </PressBtn>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
        <Button variant="primary" size="small" label="Save" onPress={handleSave} />
      </View>
    </CenteredModal>
  );
}

// -- Friend row ----------------------------------------------------------------

function FriendRow({ friend, index, onEdit }: { friend: Person; index: number; onEdit: () => void }) {
  const { removeFriend } = useSplitStore();
  const swipeRef = useRef<Swipeable>(null);
  const color = AVATAR_PALETTE[index % AVATAR_PALETTE.length];

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={(p) => {
        const w = p.interpolate({ inputRange: [0, 1], outputRange: [36, 74], extrapolate: 'clamp' });
        const op = p.interpolate({ inputRange: [0.5, 0.9], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <PressBtn style={s.swipeActionWrap}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); removeFriend(friend.id); }} activeOpacity={0.85}>
            <Animated.View style={[s.swipePill, { width: w, backgroundColor: '#D95F52' }]}>
              <TrashIcon color="#fff" size={15} />
              <Animated.Text style={[s.swipePillText, { opacity: op }]}>Remove</Animated.Text>
            </Animated.View>
          </PressBtn>
        );
      }}
      renderLeftActions={(p) => {
        const w = p.interpolate({ inputRange: [0, 1], outputRange: [36, 74], extrapolate: 'clamp' });
        const op = p.interpolate({ inputRange: [0.5, 0.9], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <PressBtn style={s.swipeActionWrap}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onEdit(); }} activeOpacity={0.85}>
            <Animated.View style={[s.swipePill, { width: w, backgroundColor: '#4A90D9' }]}>
              <PencilIcon color="#fff" size={15} />
              <Animated.Text style={[s.swipePillText, { opacity: op }]}>Edit</Animated.Text>
            </Animated.View>
          </PressBtn>
        );
      }}
    >
      <Card onPress={onEdit} pressBorderColor={color.bg} style={s.row}>
        <Avatar name={friend.name} index={index} size={42} />
        <Text style={s.name}>{friend.name}</Text>
      </Card>
    </Swipeable>
  );
}

// -- Suggestion row (from transactions) ---------------------------------------

function SuggestionRow({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <View style={s.suggRow}>
      <View style={[s.avatar, { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }]}>
        <Text style={[s.avatarText, { color: C.textSub }]}>{initials(name)}</Text>
      </View>
      <Text style={[s.name, { flex: 1, color: C.textSub }]}>{name}</Text>
      <Button variant="secondary" size="small" icon={<PlusIcon color={C.text} size={14} />} label="Add" onPress={onAdd} />
    </View>
  );
}

// -- Screen --------------------------------------------------------------------

export default function FriendsScreen() {
  const { friends, addFriend, history } = useSplitStore();
  const [input, setInput] = useState('');
  const [editFriend, setEditFriend] = useState<Person | null>(null);

  // Mine all unique names from history that aren't already friends
  const suggestions = useMemo(() => {
    const friendNames = new Set(friends.map((f) => f.name.toLowerCase()));
    const seen = new Set<string>();
    const names: string[] = [];
    for (const tab of history) {
      for (const name of tab.people) {
        const key = name.toLowerCase();
        if (!friendNames.has(key) && !seen.has(key)) {
          seen.add(key);
          names.push(name);
        }
      }
    }
    return names.slice(0, 10);
  }, [history, friends]);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (friends.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) return;
    mediumHaptic();
    addFriend(trimmed);
    setInput('');
  };

  const sorted = [...friends].sort((a, b) => a.name.localeCompare(b.name));

  const sections = [
    ...(sorted.length > 0 ? [{ title: 'MY FRIENDS', data: sorted, kind: 'friend' as const }] : []),
    ...(suggestions.length > 0 ? [{ title: 'FROM YOUR BILLS', data: suggestions.map(n => ({ id: n, name: n })), kind: 'suggestion' as const }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'Friends',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
      }} />
      {/* Add bar */}
      <View style={s.addBar}>
        <Input
          style={s.addInput}
          value={input}
          onChangeText={setInput}
          placeholder="Friend's name"
          placeholderTextColor={C.textDim}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          autoCapitalize="words"
        />
        <PressBtn
          style={[s.addCircle, input.trim().length > 0 && s.addCircleActive]}
          onPress={handleAdd} activeOpacity={0.7} disabled={!input.trim()}>
          <PlusIcon color={input.trim() ? '#fff' : C.textDim} size={20} />
        </PressBtn>
      </View>

      {sections.length === 0 ? (
        <View style={s.empty}>
          <IconBadge size={72} bg={C.card}>
            <UserIcon size={32} color={C.textSub} />
          </IconBadge>
          <Text style={s.emptyTitle}>No friends yet</Text>
          <Text style={s.emptyDesc}>Add friends to quickly add them to future tabs and trips.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index, section }) =>
            (section as any).kind === 'friend' ? (
              <FriendRow friend={item as Person} index={index} onEdit={() => setEditFriend(item as Person)} />
            ) : (
              <SuggestionRow name={item.name}
                onAdd={() => { selectionHaptic(); addFriend(item.name); }} />
            )
          }
          renderSectionHeader={({ section: { title } }) => (
            <View style={s.sectionHeader}>
              <SectionLabel>{title}</SectionLabel>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <EditFriendModal friend={editFriend} onClose={() => setEditFriend(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  listContent: { padding: 16, paddingTop: 8 },
  sep: { height: 8 },

  addBar: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  addInput: { flex: 1, minWidth: 0 },
  addCircle: { width: InputMetrics.height, height: InputMetrics.height, borderRadius: InputMetrics.radius, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  addCircleActive: { backgroundColor: C.primary, borderColor: C.primary },

  sectionHeader: { paddingTop: 8, paddingBottom: 8, backgroundColor: C.bg },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.card, borderRadius: Radius.sm, padding: Spacing.md },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.card, borderRadius: Radius.sm, padding: Spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primaryDim, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: C.primary },
  name: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },

  swipeActionWrap: { width: 80, justifyContent: 'center', alignItems: 'center' },
  swipePill: { height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, overflow: 'hidden' },
  swipePillText: { color: '#fff', fontSize: 11, fontFamily: 'Poppins_500Medium' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text },
  emptyDesc: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  // Modal
  input: {},
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  groupChipActive: { backgroundColor: C.primaryDim, borderColor: C.primary + '60' },
  groupChipText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.text },
});
