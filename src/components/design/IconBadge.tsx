import { View } from 'react-native';
import { Badge } from '@/constants/spacing';

export function IconBadge({
  size = Badge.size, bg, children,
}: {
  size?: number; bg: string; children: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bg, justifyContent: 'center', alignItems: 'center',
      }}
    >
      {children}
    </View>
  );
}
