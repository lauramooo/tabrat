import { Pressable } from 'react-native';

export function PressBtn({ style, activeOpacity = 0.75, noShadow, children, ...props }: any) {
  return (
    <Pressable
      style={({ pressed }) => [
        typeof style === 'function' ? style({ pressed }) : style,
        pressed && { opacity: activeOpacity },
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
