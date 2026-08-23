import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { ProfileIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { IconBadge } from '@/components/design/IconBadge';

/**
 * The current device user's own avatar — their photo if they've set one, otherwise a neutral
 * gray placeholder (never a colored AVATAR_PALETTE badge, since that palette is assigned by
 * per-trip/home ordering and this avatar has no such context). Use this wherever "you"/the
 * account owner needs an avatar, so the treatment never drifts out of sync across screens.
 */
export function ProfileAvatar({ photoUri, size = 64 }: { photoUri?: string | null; size?: number }) {
  // A stored photo URI can go stale (e.g. a web blob: URL from expo-image-picker doesn't
  // survive a page reload) — fall back to the icon instead of rendering nothing when that happens.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUri]);

  if (photoUri && !failed) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <IconBadge size={size} bg={C.card}>
      <ProfileIcon size={Math.round(size * 0.53)} color={C.textSub} />
    </IconBadge>
  );
}
