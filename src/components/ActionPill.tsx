import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { Animated, StyleSheet, View } from 'react-native';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { toSentenceCase } from '@/utils/text';

export function ActionPill({ progress, icon, iconNode, label, color, textColor = C.text, onPress }: {
  progress: Animated.AnimatedInterpolation<number>;
  icon?: string;
  iconNode?: (color: string) => React.ReactNode;
  label: string;
  color: string;
  textColor?: string;
  onPress: () => void;
}) {
  // Swipeable's `progress` is driven by the native animation driver, which doesn't support
  // animating `width` — that interpolation silently never applies, so the pill was permanently
  // stuck at its width:36 starting value (a circle) instead of ever reaching the full pill shape.
  // Fixing the width and only fading the label in (opacity IS natively supported) gives the same
  // reveal feel without relying on an animated property that can't actually run here.
  const textOp = progress.interpolate({ inputRange: [0.5, 0.9], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <PressBtn style={s.wrap} onPress={onPress} activeOpacity={0.85} hitSlop={4}>
      <View style={[s.pill, { backgroundColor: color }]}>
        {iconNode ? iconNode(textColor) : <MaterialCommunityIcons name={icon as any} size={15} color={textColor} />}
        <Animated.Text style={[s.label, { opacity: textOp, color: textColor }]}>{toSentenceCase(label)}</Animated.Text>
      </View>
    </PressBtn>
  );
}

const s = StyleSheet.create({
  wrap: { width: 84, justifyContent: 'center', alignItems: 'center' },
  pill: { width: 80, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, overflow: 'hidden' },
  label: { ...Type.pillLabel },
});
