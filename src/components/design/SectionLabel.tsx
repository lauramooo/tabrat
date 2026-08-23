import { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ ...Type.sectionLabel, color: C.text }, style]}>{children}</Text>;
}

export function FieldLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ ...Type.fieldLabel, color: C.textSub, textTransform: 'uppercase', marginBottom: 6 }, style]}>
      {children}
    </Text>
  );
}
