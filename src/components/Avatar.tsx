import { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { AVATAR_PALETTE } from '@/constants/colors';
import { useMyName, useMyPhoto } from '@/utils/sortPeople';

function getInitials(name: string, twoLetter: boolean): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (!twoLetter) return trimmed[0].toUpperCase();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Shared person avatar — circle + initials, colored from the single AVATAR_PALETTE source of truth.
// Use this wherever a person/friend gets a colored initial badge so the palette never drifts out of sync again.
// When `name` matches the device user's own profile name, their photo (if set) renders instead of the
// colored initials, so their real picture follows them everywhere they're represented as a person.
export function Avatar({ name, index, size = 36, fontSize, twoLetter = false, style }: {
  name: string;
  index: number;
  size?: number;
  fontSize?: number;
  twoLetter?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  const myName = useMyName();
  const myPhoto = useMyPhoto();
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => { setPhotoFailed(false); }, [myPhoto]);

  const isMe = !!myName && name.trim().toLowerCase() === myName.trim().toLowerCase();

  if (isMe && myPhoto && !photoFailed) {
    return (
      <Image
        source={{ uri: myPhoto }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style] as StyleProp<ImageStyle>}
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color.bg, justifyContent: 'center', alignItems: 'center' },
        style,
      ]}
    >
      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: fontSize ?? Math.round(size * 0.38), color: color.text }}>
        {getInitials(name, twoLetter)}
      </Text>
    </View>
  );
}
