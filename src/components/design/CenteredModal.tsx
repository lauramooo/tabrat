import { cloneElement, isValidElement } from 'react';
import { Modal, Pressable, StyleSheet, TextStyle, View } from 'react-native';
import { CircleIconButton } from './CircleIconButton';
import { C } from '@/constants/colors';
import { Radius, Spacing } from '@/constants/spacing';

// Bold display webfonts (Poppins_900Black etc.) reserve extra descender leading below the
// baseline that the browser/OS includes in the line box. Flexbox centers that whole box against
// the close icon's exact pixel height, so the glyphs end up optically higher than the icon.
// Tightening the title's line-height to just above its cap-height removes that slack so the two
// align — done once here so every modal built on CenteredModal gets it, not per-screen.
function tightenTitleLineHeight(node: React.ReactNode): React.ReactNode {
  if (!isValidElement(node)) return node;
  const props = node.props as { style?: TextStyle | TextStyle[] };
  const fontSize = StyleSheet.flatten(props.style)?.fontSize;
  if (!fontSize) return node;
  return cloneElement(node, { style: [props.style, { lineHeight: Math.round(fontSize * 1.2) }] } as any);
}

export function CenteredModal({
  visible, onClose, maxWidth = 420, padding = Spacing.xl, radius = Radius.xl, showClose = true,
  title, children,
}: {
  visible: boolean; onClose: () => void; maxWidth?: number; padding?: number; radius?: number;
  /** Set false only when the content already has an equivalent dismiss control (e.g. DatePickerModal's Cancel/Done header). */
  showClose?: boolean;
  /** Pass the modal's title element here (instead of as the first child) so it sits in a row with the
   * close button — flexbox guarantees they're vertically centered together no matter the title's font size. */
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.card, { maxWidth, padding, borderRadius: radius }]} onPress={() => {}}>
          {(title || showClose) && (
            <View style={s.headerRow}>
              <View style={{ flex: 1 }}>{tightenTitleLineHeight(title)}</View>
              {showClose && (
                <CircleIconButton variant="close" size={22} color={C.text} onPress={onClose} />
              )}
            </View>
          )}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: C.bg, width: '100%', gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
