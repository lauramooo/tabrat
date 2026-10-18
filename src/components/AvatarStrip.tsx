import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { C } from '@/constants/colors';

// The small overlapping avatars under a trip or home's name — shared by the Dashboard and
// Expenses tabs of both, so the header reads identically whichever tab is showing.
export function AvatarStrip({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <View style={s.strip}>
      {names.slice(0, 8).map((name, i) => (
        <Avatar
          key={name}
          name={name}
          index={i}
          size={18}
          fontSize={8}
          style={[s.avatar, { marginLeft: i === 0 ? 0 : -5, zIndex: 10 - i }]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 4 },
  avatar: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.bg },
});
