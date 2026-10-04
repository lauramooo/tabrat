import { StyleSheet, View } from 'react-native';
import { PencilIcon } from '@/components/FigmaIcons';
import { PressBtn } from '@/components/PressBtn';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { C } from '@/constants/colors';

// The tappable profile photo + edit badge, used identically on the Account page and the
// "Set up your profile" onboarding screen — one place to change the badge for both.
export function ProfilePhotoButton({ photoUri, size = 64, onPress }: {
  photoUri?: string | null; size?: number; onPress: () => void;
}) {
  return (
    <PressBtn style={s.wrap} onPress={onPress} activeOpacity={0.8}>
      <ProfileAvatar photoUri={photoUri} size={size} />
      <View style={s.badge}>
        <PencilIcon size={13} color={C.text} />
      </View>
    </PressBtn>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
});
