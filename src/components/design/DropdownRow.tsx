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
        <View style={styles.content}>{children}</View>
        {trailing}
      </PressBtn>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 46 },
  // Centered on the icon whatever the caller's text styles are — a `flex: 1` on the text used to
  // stretch it to the row's height on native, pinning the name to the top while the icon sat centered.
  content: { flex: 1, justifyContent: 'center' },
});
