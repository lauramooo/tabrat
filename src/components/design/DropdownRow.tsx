import { StyleSheet, View } from 'react-native';
import { PressBtn } from '@/components/PressBtn';
import { Divider } from './Divider';

export function DropdownRow({
  icon, children, trailing, onPress, divider = true,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <>
      {divider && <Divider />}
      <PressBtn style={styles.row} onPress={onPress} activeOpacity={0.7}>
        {icon}
        <View style={{ flex: 1 }}>{children}</View>
        {trailing}
      </PressBtn>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 46 },
});
