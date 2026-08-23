import { StyleProp, View, ViewStyle } from 'react-native';
import { C } from '@/constants/colors';

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: C.border }, style]} />;
}
