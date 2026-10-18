import { StyleProp, ViewStyle } from 'react-native';

import { XMarkIcon } from '@/components/FigmaIcons';
import { PressBtn } from '@/components/PressBtn';
import { C, CHIP_PALETTE } from '@/constants/colors';
import { Text } from '@/components/design/Text';

// Shared person/friend chip: selected = light fill, unselected = no fill — always black stroke + black text.
export function PersonChip({
  name, index, selected = true, removable = false, size = 'md', onPress, style,
}: {
  name: string;
  index: number;
  selected?: boolean;
  removable?: boolean;
  size?: 'sm' | 'md';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = CHIP_PALETTE[index % CHIP_PALETTE.length];
  const sizeStyle = size === 'sm'
    ? { paddingHorizontal: 10, paddingVertical: 3 }
    : { paddingHorizontal: 13, paddingVertical: 7 };
  const fontSize = size === 'sm' ? 11 : 13;

  return (
    <PressBtn
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1.5, borderColor: C.text, backgroundColor: selected ? bg : 'transparent' },
        sizeStyle,
        style,
      ]}
    >
      <Text style={{ color: C.text, fontFamily: 'Poppins_600SemiBold', fontSize }}>{name}</Text>
      {removable && <XMarkIcon color={C.text} size={10} />}
    </PressBtn>
  );
}
