import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { ScissorIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';

const CARD_W = 230;

export function ScissorAnimation({ label }: { label?: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.delay(220),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(380),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scissorsX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-55, CARD_W + 15],
  });

  return (
    <>
      <View style={s.card}>
        <View style={[s.bar, { width: '52%', height: 11, alignSelf: 'center', marginBottom: 8 }]} />
        <View style={s.line} />
        <View style={[s.line, { width: '78%' }]} />
        <View style={s.line} />
        <View style={[s.line, { width: '65%' }]} />
        <View style={s.cutZone}>
          <View style={s.dashes}>
            {Array.from({ length: 14 }).map((_, i) => (
              <View key={i} style={s.dash} />
            ))}
          </View>
          <Animated.View
            pointerEvents="none"
            style={[s.scissors, { transform: [{ translateX: scissorsX }] }]}
          >
            <View style={s.scissorsIcon}>
              <ScissorIcon size={28} color={C.primary} />
            </View>
          </Animated.View>
        </View>
        <View style={[s.line, { width: '72%' }]} />
        <View style={s.line} />
        <View style={s.totalRow}>
          <View style={[s.bar, { width: 38 }]} />
          <View style={[s.bar, { width: 58, backgroundColor: C.primaryDim }]} />
        </View>
      </View>
      {label ? <Text style={s.label}>{label}</Text> : null}
    </>
  );
}

export function ScanningOverlay() {
  return (
    <View style={s.overlay}>
      <ScissorAnimation label="Reading your receipt�" />
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(245,244,240,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 22,
    gap: 10,
    overflow: 'visible',
  },
  bar: {
    height: 9,
    backgroundColor: '#E4E2DD',
    borderRadius: 5,
  },
  line: {
    height: 8,
    width: '100%',
    backgroundColor: '#EDECEA',
    borderRadius: 4,
  },
  cutZone: {
    height: 30,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 2,
    overflow: 'visible',
  },
  dashes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dash: {
    width: 8,
    height: 2.5,
    backgroundColor: C.primary,
    borderRadius: 1.5,
    opacity: 0.5,
  },
  scissors: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    left: 0,
    zIndex: 10,
  },
  scissorsIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  label: {
    color: C.textSub,
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    letterSpacing: 0.2,
  },
});
