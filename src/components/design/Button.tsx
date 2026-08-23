import { cloneElement, isValidElement, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { PressBtn } from '@/components/PressBtn';
import { C } from '@/constants/colors';
import { Radius, Spacing } from '@/constants/spacing';
import { Type } from '@/constants/typography';
import { toSentenceCase } from '@/utils/text';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'filter' | 'filterWide' | 'destructive' | 'inactive';
export type ButtonSize = 'small' | 'big';

const YELLOW = '#F7D76A';
const YELLOW_PRESSED = '#E7C94D';
const ERROR_PRESSED = '#DE6354';
const BIG_HEIGHT = 54;

export function Button({
  variant, size = 'big', active = false, label, icon, onPress, disabled, style,
}: {
  variant: ButtonVariant; size?: ButtonSize; active?: boolean;
  label: string; icon?: React.ReactNode; onPress?: () => void; disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);
  const effectiveVariant: ButtonVariant = disabled ? 'inactive' : variant;

  const container: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  };
  const sizeStyle: ViewStyle =
    size === 'small' ? { paddingHorizontal: 12, height: 32, borderRadius: Radius.pill }
    : { alignSelf: 'stretch', height: BIG_HEIGHT, borderRadius: Radius.pill };

  let bg = 'transparent';
  let textColor: string = C.text;
  let borderWidth = 0;
  let borderColor: string = C.text;
  let bold = false;

  switch (effectiveVariant) {
    case 'primary':
      bg = pressed ? YELLOW_PRESSED : YELLOW;
      borderWidth = 1.5;
      bold = pressed;
      break;
    case 'secondary':
      bg = pressed ? C.card : 'transparent';
      borderWidth = 1.5;
      bold = pressed;
      break;
    case 'tertiary':
      bold = pressed;
      break;
    case 'filter':
      bg = active ? C.text : C.card;
      textColor = active ? C.bg : C.text;
      break;
    case 'filterWide':
      bg = C.card;
      borderWidth = pressed ? 1.5 : 0;
      bold = pressed;
      break;
    case 'destructive':
      bg = pressed ? ERROR_PRESSED : C.error;
      textColor = C.text;
      borderWidth = 1.5;
      break;
    case 'inactive':
      borderWidth = 1.5;
      borderColor = C.textDim;
      textColor = C.textDim;
      break;
  }

  const baseTextStyle = size === 'small' ? Type.pillLabel : Type.buttonLg;
  const iconSize = size === 'small' ? 13 : 16;

  return (
    <PressBtn
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      noShadow
      activeOpacity={1}
      disabled={disabled}
      style={[
        container, sizeStyle,
        borderWidth ? { borderWidth, borderColor } : null,
        { backgroundColor: bg },
        style,
      ]}
    >
      {isValidElement(icon)
        ? cloneElement(icon as React.ReactElement<{ color?: string; size?: number }>, {
            size: iconSize,
            ...(effectiveVariant === 'inactive' ? { color: textColor } : null),
          })
        : icon}
      <Text style={[baseTextStyle, { color: textColor }, bold && { fontFamily: 'Poppins_700Bold' }]}>{toSentenceCase(label)}</Text>
    </PressBtn>
  );
}
