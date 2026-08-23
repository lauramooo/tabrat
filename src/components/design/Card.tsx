import { useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import { C } from '@/constants/colors';
import { Radius, Spacing } from '@/constants/spacing';

const STROKE_WIDTH = 2;

export function Card({
  padding = Spacing.md, radius = Radius.sm, row = true, style, children,
  onPress, onLongPress, pressBorderColor,
}: {
  padding?: number; radius?: number; row?: boolean;
  style?: StyleProp<ViewStyle>; children: React.ReactNode;
  onPress?: () => void; onLongPress?: () => void;
  /** Card is a passive View unless onPress is given. When pressed, shows a stroke in this color — pass the category's light/bg token (e.g. C.tripBg) per the "lighter color of the icon" rule. */
  pressBorderColor?: string;
}) {
  const [pressed, setPressed] = useState(false);

  // Border width is constant (never 0→N) so toggling it never changes the card's box size —
  // only the color toggles between transparent and the stroke color. This is what prevents
  // content from shifting when the stroke appears on press.
  const cardStyle = [
    {
      backgroundColor: C.card, borderRadius: radius, padding,
      ...(row ? { flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.md } : null),
      borderWidth: pressBorderColor ? STROKE_WIDTH : 0,
      borderColor: pressed && pressBorderColor ? pressBorderColor : 'transparent',
    },
    style,
  ];

  if (!onPress) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <RectButton
      onPress={onPress}
      onLongPress={onLongPress}
      onActiveStateChange={setPressed}
      activeOpacity={0}
      underlayColor="transparent"
      style={cardStyle}
    >
      {children}
    </RectButton>
  );
}
