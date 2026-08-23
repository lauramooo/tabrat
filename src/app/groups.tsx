import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { PressBtn } from '@/components/PressBtn';
import { PencilIcon, PlusIcon, TrashIcon, UserMultipleIcon, XMarkIcon } from '@/components/FigmaIcons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, CircleIconButton, FieldLabel, IconBadge, Input } from '@/components/design';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { InputMetrics, Radius } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import { toSentenceCase } from '@/utils/text';
import type { Group } from '@/types';

const DEFAULT_GROUP_ICON = '👥';

// -- Animated swipe pill (same pattern as home/review) -------------------------
// NOTE: kept local (not consolidated onto shared @/components/ActionPill) because
// the width/opacity interpolation ranges differ (36->74 / wrap 80 here vs
// 36->80 / wrap 84 in the shared component) — merging would change this
// screen's swipe-reveal animation.

function ActionPill({
  progress, icon, iconNode, label, color, textColor = C.text, onPress,
}: {
  progress: Animated.AnimatedInterpolation<number>;
  icon?: string; iconNode?: React.ReactNode; label: string; color: string; textColor?: string; onPress: () => void;
}) {
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [36, 74], extrapolate: 'clamp' });
  const textOp = progress.interpolate({ inputRange: [0.5, 0.9], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <PressBtn style={s.actionWrap} onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[s.actionPill, { width, backgroundColor: color }]}>
        {iconNode ?? <MaterialCommunityIcons name={icon as any} size={15} color={textColor} />}
        <Animated.Text style={[s.actionLabel, { opacity: textOp, color: textColor }]}>{toSentenceCase(label)}</Animated.Text>
      </Animated.View>
    </PressBtn>
  );
}

// -- Create / Edit group modal --------------------------------------------------

interface GroupModalProps {
  visible: boolean;
  onClose: () => void;
  editGroup: Group | null;
}

function GroupModal({ visible, onClose, editGroup }: GroupModalProps) {
  const { addGroup, updateGroup, friends } = useSplitStore();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(editGroup?.name ?? '');
      setMembers(editGroup?.members ?? []);
      setMemberInput('');
      setError(null);
    }
  }, [visible]);

  const handleAddMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    if (members.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already in this group.`);
      return;
    }
    setError(null);
    selectionHaptic();
    setMembers((prev) => [...prev, trimmed]);
    setMemberInput('');
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Please enter a group name.'); return; }
    if (members.length === 0) { setError('Add at least one member.'); return; }
    mediumHaptic();
    if (editGroup) {
      updateGroup(editGroup.id, trimmedName, editGroup.icon, members);
    } else {
      addGroup(trimmedName, DEFAULT_GROUP_ICON, members);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={() => {}}>
          <View style={s.modalHeaderRow}>
            <Text style={s.modalTitle}>{editGroup ? 'Edit group' : 'New group'}</Text>
            <CircleIconButton variant="close" size={22} color={C.text} onPress={onClose} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20 }}>
              {/* Group name */}
              <View style={{ gap: 6 }}>
                <FieldLabel style={{ marginBottom: 0 }}>GROUP NAME</FieldLabel>
                <Input
                  placeholder="e.g. Work Crew, Weekend Squad"
                  placeholderTextColor={C.textDim}
                  value={name}
                  onChangeText={(v) => { setName(v); setError(null); }}
                  style={s.input}
                />
              </View>

              {/* Members */}
              <View style={{ gap: 8 }}>
                <FieldLabel style={{ marginBottom: 0 }}>MEMBERS</FieldLabel>

                {/* Friends quick-add */}
                {friends.length > 0 && (
                  <View style={s.friendsQuickAdd}>
                    <Text style={s.friendsQuickLabel}>FROM FRIENDS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {friends
                        .filter((f) => !members.includes(f.name))
                        .map((f) => (
                          <PressBtn key={f.id} style={s.friendQuickChip}
                            onPress={() => { selectionHaptic(); setMembers((prev) => [...prev, f.name]); }} activeOpacity={0.7}>
                            <Text style={s.friendQuickText}>{f.name}</Text>
                            <PlusIcon color={C.primary} size={12} />
                          </PressBtn>
                        ))}
                    </ScrollView>
                  </View>
                )}

                <View style={s.memberInputRow}>
                  <Input
                    placeholder="Or type a name"
                    placeholderTextColor={C.textDim}
                    value={memberInput}
                    onChangeText={(v) => { setMemberInput(v); setError(null); }}
                    onSubmitEditing={handleAddMember}
                    returnKeyType="done"
                    style={[s.input, { flex: 1, minWidth: 0 }]}
                  />
                  <Button
                    variant="primary"
                    size="small"
                    label="Add"
                    onPress={handleAddMember}
                    disabled={!memberInput.trim()}
                    style={s.addMemberBtn}
                  />
                </View>
                {members.length > 0 && (
                  <View style={s.memberChips}>
                    {members.map((member) => (
                      <PressBtn
                        key={member}
                        style={s.memberChip}
                        onPress={() => { selectionHaptic(); setMembers((prev) => prev.filter((m) => m !== member)); }}
                        activeOpacity={0.7}
                      >
                        <Text style={s.memberChipText}>{member}</Text>
                        <XMarkIcon size={13} color={C.textSub} />
                      </PressBtn>
                    ))}
                  </View>
                )}
              </View>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <View style={s.modalBtns}>
                <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
                <Button variant="primary" size="small" label="Save Group" onPress={handleSave} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// -- Group card with swipe actions ---------------------------------------------

function GroupItem({
  group, index, onEdit, onDelete,
}: { group: Group; index: number; onEdit: () => void; onDelete: () => void }) {
  const swipeRef = useRef<Swipeable>(null);
  const color = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={(progress) => (
        <ActionPill
          progress={progress} iconNode={<TrashIcon color={C.text} size={15} />} label="Delete" color={C.error}
          onPress={() => { lightHaptic(); swipeRef.current?.close(); onDelete(); }}
        />
      )}
      renderLeftActions={(progress) => (
        <ActionPill
          progress={progress} iconNode={<PencilIcon color={C.text} size={15} />} label="Edit" color={C.pillInfo}
          onPress={() => { lightHaptic(); swipeRef.current?.close(); onEdit(); }}
        />
      )}
    >
      <Card onPress={onEdit} pressBorderColor={color.bg} style={s.groupCard} padding={16}>
        <IconBadge bg={color.bg}>
          <UserMultipleIcon color={color.text} size={18} />
        </IconBadge>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.groupCardName}>{group.name}</Text>
          <Text style={s.groupCardMembers} numberOfLines={1}>{group.members.join(', ')}</Text>
        </View>
        <IconBadge size={32} bg={C.primaryDim}>
          <Text style={s.memberCountText}>{group.members.length}</Text>
        </IconBadge>
      </Card>
    </Swipeable>
  );
}

// -- Screen --------------------------------------------------------------------

export default function GroupsScreen() {
  const { groups, deleteGroup } = useSplitStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const openCreate = () => { setEditingGroup(null); setModalVisible(true); lightHaptic(); };
  const openEdit = (group: Group) => { setEditingGroup(group); setModalVisible(true); lightHaptic(); };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'Groups',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
      }} />
      {groups.length === 0 ? (
        <View style={s.empty}>
          <IconBadge size={72} bg={C.card}>
            <UserMultipleIcon size={32} color={C.textSub} />
          </IconBadge>
          <Text style={s.emptyTitle}>No groups yet</Text>
          <Text style={s.emptyText}>
            Create a group to quickly add everyone to a split — no retyping names each time.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          renderItem={({ item, index }) => (
            <GroupItem
              group={item}
              index={index}
              onEdit={() => openEdit(item)}
              onDelete={() => { mediumHaptic(); deleteGroup(item.id); }}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={s.listContent}
          style={s.list}
        />
      )}

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          icon={<PlusIcon size={18} color={C.text} />}
          label="New Group"
          onPress={openCreate}
        />
      </View>

      <GroupModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editGroup={editingGroup}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text, textAlign: 'center' },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  list: { flex: 1 },
  listContent: { padding: 16 },

  groupCard: { gap: 14 },
  groupCardName: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: C.text },
  groupCardMembers: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textSub },
  memberCountText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.text },

  actionWrap: { width: 80, justifyContent: 'center', alignItems: 'center' },
  actionPill: {
    height: 36, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingHorizontal: 8, overflow: 'hidden',
  },
  actionLabel: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  footer: { padding: 16, paddingTop: 8 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalSheet: {
    backgroundColor: C.bg, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 24, maxHeight: '88%',
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  modalTitle: { fontFamily: 'Poppins_900Black', fontSize: 26, color: C.text, letterSpacing: 0.3, lineHeight: 31 },

  input: {},

  memberInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addMemberBtn: { flex: 0, alignSelf: 'stretch', paddingHorizontal: 20, borderRadius: InputMetrics.radius },

  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  memberChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.text },

  errorText: { color: C.error, fontSize: 13, fontFamily: 'Poppins_400Regular' },

  friendsQuickAdd: { gap: 6 },
  friendsQuickLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: C.textDim, letterSpacing: 0.8 },
  friendQuickChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary + '40' },
  friendQuickText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.text },

  modalBtns: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
});
