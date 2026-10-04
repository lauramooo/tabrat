import { Stack } from 'expo-router';
import { PressBtn } from '@/components/PressBtn';
import { ActionPill } from '@/components/ActionPill';
import { Avatar } from '@/components/Avatar';
import { PencilIcon, PlusIcon, TrashIcon, UserIcon, UserMultipleIcon } from '@/components/FigmaIcons';
import { useMemo, useRef, useState } from 'react';
import {
  ScrollView, SectionList,
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
    <CenteredModal visible={!!friend} onClose={onClose} title={<Text style={{ ...Type.h1, color: C.text }}>Edit rat</Text>}>
      <FieldLabel>NAME</FieldLabel>
      <Input
        style={s.input}
        value={name}
        onChangeText={setName}
        autoFocus
        placeholder="Rat's name"
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

function FriendRow({ friend, index, sharedCount, onEdit }: { friend: Person; index: number; sharedCount: number; onEdit: () => void }) {
  const { removeFriend } = useSplitStore();
  const swipeRef = useRef<Swipeable>(null);
  const color = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  const subtitle = sharedCount > 0 ? `${sharedCount} shared bill${sharedCount !== 1 ? 's' : ''}` : 'No shared bills yet';

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={(p) => (
        <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Remove" color="#D95F52" textColor="#fff"
          onPress={() => { lightHaptic(); swipeRef.current?.close(); removeFriend(friend.id); }} />
      )}
      renderLeftActions={(p) => (
        <ActionPill progress={p} iconNode={(c) => <PencilIcon color={c} size={15} />} label="Edit" color="#4A90D9" textColor="#fff"
          onPress={() => { lightHaptic(); swipeRef.current?.close(); onEdit(); }} />
      )}
    >
      <Card onPress={onEdit} pressBorderColor={color.bg} style={s.row}>
        <Avatar name={friend.name} index={index} size={42} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.name} numberOfLines={1}>{friend.name}</Text>
          <Text style={s.friendSub} numberOfLines={1}>{subtitle}</Text>
        </View>
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
    ...(sorted.length > 0 ? [{ title: 'MY RATS', data: sorted, kind: 'friend' as const }] : []),
    ...(suggestions.length > 0 ? [{ title: 'FROM YOUR BILLS', data: suggestions.map(n => ({ id: n, name: n })), kind: 'suggestion' as const }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'Rats',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
      }} />
      {/* Add bar */}
      <View style={s.addBar}>
        <Input
          style={s.addInput}
          value={input}
          onChangeText={setInput}
          placeholder="Rat's name"
          placeholderTextColor={C.textDim}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          autoCapitalize="words"
        />
        <PressBtn
          style={[s.addCircle, input.trim().length > 0 && s.addCircleActive]}
          onPress={handleAdd} activeOpacity={0.7} disabled={!input.trim()}>
          <PlusIcon color={C.text} size={20} />
        </PressBtn>
      </View>

      {sections.length === 0 ? (
        <View style={s.empty}>
          <IconBadge size={72} bg={C.card}>
            <UserIcon size={32} color={C.textSub} />
          </IconBadge>
          <Text style={s.emptyTitle}>No rats yet</Text>
          <Text style={s.emptyDesc}>Add rats to quickly add them to future tabs and trips.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index, section }) =>
            (section as any).kind === 'friend' ? (
              <FriendRow
                friend={item as Person}
                index={index}
                sharedCount={history.filter((r) => r.people.some((p) => p.toLowerCase() === (item as Person).name.toLowerCase())).length}
                onEdit={() => setEditFriend(item as Person)}
              />
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
  addCircle: { width: InputMetrics.height, height: InputMetrics.height, borderRadius: 999, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  addCircleActive: { backgroundColor: C.yellow, borderColor: C.text },

  sectionHeader: { paddingTop: 8, paddingBottom: 8, backgroundColor: C.bg },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.card, borderRadius: Radius.sm, padding: Spacing.md },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.card, borderRadius: Radius.sm, padding: Spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primaryDim, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...Type.cardTitle, color: C.primary },
  name: { ...Type.cardTitle, color: C.text },
  friendSub: { ...Type.cardDesc, color: C.textSub, marginTop: -2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { ...Type.emptyTitle, color: C.text },
  emptyDesc: { ...Type.cardDesc, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  // Modal
  input: {},
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  groupChipActive: { backgroundColor: C.primaryDim, borderColor: C.primary + '60' },
  groupChipText: { ...Type.labelMedium, color: C.text },
});
