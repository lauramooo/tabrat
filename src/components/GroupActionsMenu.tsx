import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressBtn } from '@/components/PressBtn';
import { CheckCircleIcon, MoreIcon, PencilIcon, ReopenIcon, SendIcon, TrashIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { Text } from '@/components/design/Text';

// The ⋮ header button of a trip or home — shared by its Dashboard and Expenses tabs so the menu
// is identical on both.
export function GroupActionsButton({ onPress }: { onPress: () => void }) {
  return (
    <PressBtn onPress={onPress} activeOpacity={0.5} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      <MoreIcon color={C.text} size={20} />
    </PressBtn>
  );
}

// The menu the ⋮ opens. A closed group offers Reopen in place of Close only when onReopen is
// given (homes); trips always show Close.
export function GroupActionsMenu({ visible, onDismiss, closeLabel, closed, onEdit, onShare, onCloseGroup, onReopen, onDelete }: {
  visible: boolean;
  onDismiss: () => void;
  closeLabel: string;
  closed?: boolean;
  onEdit: () => void;
  onShare: () => void;
  onCloseGroup: () => void;
  onReopen?: () => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const top = insets.top + (Platform.OS === 'ios' ? 44 : 56) + 6;
  const pick = (fn: () => void) => () => { onDismiss(); fn(); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={s.backdrop} onPress={onDismiss}>
        <View style={[s.card, { top }]}>
          <PressBtn style={s.row} onPress={pick(onEdit)} activeOpacity={0.6}>
            <PencilIcon color={C.textSub} size={17} />
            <Text style={s.rowText}>Edit</Text>
          </PressBtn>
          <PressBtn style={[s.row, s.divider]} onPress={pick(onShare)} activeOpacity={0.6}>
            <SendIcon color={C.textSub} size={17} />
            <Text style={s.rowText}>Share</Text>
          </PressBtn>
          {closed && onReopen ? (
            <PressBtn style={[s.row, s.divider]} onPress={pick(onReopen)} activeOpacity={0.6}>
              <ReopenIcon size={17} color={C.textSub} />
              <Text style={s.rowText}>Reopen</Text>
            </PressBtn>
          ) : (
            <PressBtn style={[s.row, s.divider]} onPress={pick(onCloseGroup)} activeOpacity={0.6}>
              <CheckCircleIcon color={C.textSub} size={17} />
              <Text style={s.rowText}>{closeLabel}</Text>
            </PressBtn>
          )}
          <PressBtn style={[s.row, s.divider]} onPress={pick(onDelete)} activeOpacity={0.6}>
            <TrashIcon color={C.error} size={17} />
            <Text style={[s.rowText, { color: C.error }]}>Delete</Text>
          </PressBtn>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  card: { position: 'absolute', right: 10, backgroundColor: C.bg, borderRadius: 14, width: 210, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  rowText: { ...Type.bodySmall, color: C.text },
});
