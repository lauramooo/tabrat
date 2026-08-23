import { Modal, Pressable, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { C } from '@/constants/colors';

export type DropdownPosition = { top?: number; bottom?: number; left?: number; right?: number; width?: number; minWidth?: number };

export function Dropdown({
  visible, position, onClose, children, maxHeight = 320, style, scroll = true, mode = 'modal',
}: {
  visible: boolean;
  position: DropdownPosition | null;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  style?: ViewStyle;
  /** Set false when content manages its own scroll region (e.g. a pinned search row above a scrollable list). */
  scroll?: boolean;
  /**
   * 'modal' (default): detached floating card rendered in a native Modal, positioned from
   * window coordinates (measureInWindow). Best for tap-to-pick pickers (currency, category…).
   * 'inline': absolutely positioned in the normal view tree — no Modal, no backdrop. Required
   * whenever the anchor is a live TextInput that must stay focused while the dropdown is open
   * (e.g. type-ahead search): a Modal steals native focus from the input the instant it mounts,
   * and its full-screen backdrop blocks touches on everything else on screen while it's up.
   * The nearest ancestor should be `position:'relative'` with a raised `zIndex` while open, since
   * the card spans the full width of that ancestor (left:0, right:0) — `position.top` is the only
   * coordinate that matters here.
   */
  mode?: 'modal' | 'inline';
}) {
  if (!visible || !position) return null;

  const content = scroll ? <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView> : children;

  if (mode === 'inline') {
    return (
      <View style={[styles.card, styles.inlineCard, { top: position.top, maxHeight }, style]}>
        {content}
      </View>
    );
  }

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, position, { maxHeight }, style]} onPress={() => {}}>
          {content}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  card: {
    position: 'absolute',
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  inlineCard: { left: 0, right: 0, zIndex: 20 },
});
