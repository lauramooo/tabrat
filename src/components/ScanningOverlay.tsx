import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { ScissorIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Radius } from '@/constants/spacing';
import { Type } from '@/constants/typography';

const CARD_W = 230;
// Web has no native animation driver — passing useNativeDriver there just prints a warning
// every time, so it's only enabled on native platforms where it actually does something.
const NATIVE_DRIVER = Platform.OS !== 'web';

export function ScissorAnimation({ label }: { label?: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1700, useNativeDriver: NATIVE_DRIVER }),
        Animated.delay(220),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: NATIVE_DRIVER }),
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
            style={[s.scissors, { transform: [{ translateX: scissorsX }] }, { pointerEvents: 'none' }]}
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

// A long multi-guest receipt takes 20-30s to read accurately (see scan-receipt), and there's no
// real progress to report — so the message advances on a timer instead, to show it isn't stuck.
const SCAN_MESSAGES: [number, string][] = [
  [0, 'Reading your receipt…'],
  [8000, 'Still reading — long receipts take a little longer'],
  [20000, 'Almost there, checking every price…'],
];

const SCAN_LINE_H = 3;
const SCAN_GLOW_H = 28;

// Sits over the receipt photo while it's being read: dims the photo and sweeps a glowing scan line
// up and down `frame` (the crop box, so it scans what's actually being sent), with the timed status
// message on top. Absorbs touches so the crop handles can't move mid-scan.
export function ScanningOverlay({ frame }: { frame: { top: number; left: number; width: number; height: number } }) {
  const [label, setLabel] = useState(SCAN_MESSAGES[0][1]);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timers = SCAN_MESSAGES.slice(1).map(([ms, text]) => setTimeout(() => setLabel(text), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1500, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(sweep, { toValue: 0, duration: 1500, useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const lineY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, frame.height - SCAN_LINE_H)] });

  return (
    <View style={[StyleSheet.absoluteFill, s.scanDim]} onStartShouldSetResponder={() => true}>
      <View style={[s.scanFrame, frame]}>
        <Animated.View style={[s.scanLineWrap, { transform: [{ translateY: lineY }] }]}>
          <LinearGradient colors={[`${C.yellow}00`, `${C.yellow}55`]} style={s.scanGlow} />
          <View style={s.scanLine} />
          <LinearGradient colors={[`${C.yellow}55`, `${C.yellow}00`]} style={s.scanGlow} />
        </Animated.View>
      </View>
      <View style={s.scanLabelPill}>
        <Text style={s.scanLabel}>{label}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scanDim: { backgroundColor: `${C.primary}40` },
  scanFrame: { position: 'absolute', overflow: 'hidden' },
  scanLineWrap: { position: 'absolute', left: 0, right: 0, top: -SCAN_GLOW_H },
  scanGlow: { height: SCAN_GLOW_H },
  scanLine: {
    height: SCAN_LINE_H,
    backgroundColor: C.yellow,
    shadowColor: C.yellow,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  scanLabelPill: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  scanLabel: {
    ...Type.labelMedium,
    color: C.text,
    backgroundColor: C.card,
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    overflow: 'hidden',
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
    ...Type.labelMedium,
    letterSpacing: 0.2,
  },
});
