import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { Animated, StyleSheet } from 'react-native';
import { C } from '@/constants/colors';
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
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [36, 80], extrapolate: 'clamp' });
  const textOp = progress.interpolate({ inputRange: [0.5, 0.9], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <PressBtn style={s.wrap} onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[s.pill, { width, backgroundColor: color }]}>
        {iconNode ? iconNode(textColor) : <MaterialCommunityIcons name={icon as any} size={15} color={textColor} />}
        <Animated.Text style={[s.label, { opacity: textOp, color: textColor }]}>{toSentenceCase(label)}</Animated.Text>
      </Animated.View>
    </PressBtn>
  );
}

const s = StyleSheet.create({
  wrap: { width: 84, justifyContent: 'center', alignItems: 'center' },
  pill: { height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, overflow: 'hidden' },
  label: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
});
