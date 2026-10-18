import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useKeyboardOverlap } from '@/utils/keyboard';

// The dimmed, tap-to-dismiss layer behind every pop-up card. While the keyboard is open it pads
// itself by the keyboard's height, so the (centered) card sits in the space above the keyboard
// instead of behind it; cards should cap their height (maxHeight: '100%') and let their inner
// KeyboardAwareScrollView shrink so a tall card still fits. Every modal — CenteredModal and the
// few hand-built ones — goes through this so pop-ups all behave the same with the keyboard.
export function ModalBackdrop({ style, onPress, children }: {
  style?: StyleProp<ViewStyle>; onPress: () => void; children: React.ReactNode;
}) {
  const overlap = useKeyboardOverlap();
  const basePad = StyleSheet.flatten(style)?.paddingBottom ?? StyleSheet.flatten(style)?.padding ?? 0;
  return (
    <Pressable style={[style, overlap > 0 && { paddingBottom: overlap + (typeof basePad === 'number' ? Math.min(basePad, 12) : 12) }]} onPress={onPress}>
      {children}
    </Pressable>
  );
}
