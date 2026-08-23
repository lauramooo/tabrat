import { useState } from 'react';
import { StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import { PressBtn } from '@/components/PressBtn';
import { BackCircleIcon, CloseCircleIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';

const YELLOW = '#F7D76A';

export function CircleIconButton({
  variant, size = 22, color = C.text, onPress, style, hitSlop = 8, label, labelStyle, disabled,
}: {
  variant: 'back' | 'close'; size?: number; color?: string;
  onPress?: () => void; style?: StyleProp<ViewStyle>; hitSlop?: number;
  /** Optional trailing text (e.g. a "Back" link row) — same press-fill behavior as the icon-only button. */
  label?: string; labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const Icon = variant === 'back' ? BackCircleIcon : CloseCircleIcon;

  return (
    <PressBtn
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      noShadow
      activeOpacity={1}
      hitSlop={hitSlop}
      style={label != null ? [{ flexDirection: 'row', alignItems: 'center', gap: 4 }, style] : style}
    >
      <Icon color={color} size={size} filled={pressed} fillColor={YELLOW} />
      {label != null && <Text style={labelStyle}>{label}</Text>}
    </PressBtn>
  );
}
