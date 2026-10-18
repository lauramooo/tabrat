import { StyleSheet, View } from 'react-native';

import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { Text } from './Text';

// Stand-ins for a trip/home dashboard section before there's anything in it — the section's
// heading still shows (rendered by the caller, in that screen's own label style) with this hint
// under it, so an empty dashboard previews what will appear once expenses are added.
export function EmptyHint({ text }: { text: string }) {
  return <Text style={s.text}>{text}</Text>;
}

// An empty spending donut: the chart's gray ring with $0 in the middle and a note beside it, laid
// out exactly like the real chart + legend (same padding, gap, legend width) so nothing jumps when
// the first expense arrives.
export function EmptyPie({ size, ring, centerText, text }: { size: number; ring: number; centerText: string; text: string }) {
  return (
    <View style={s.pieRow}>
      <View style={[s.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: ring }]}>
        <Text style={s.center}>{centerText}</Text>
      </View>
      <Text style={[s.text, s.pieText]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  text: { ...Type.note, color: C.textDim },
  pieRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 12 },
  ring: { borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
  center: { ...Type.cardTitle, color: C.textDim },
  pieText: { width: 150 },
});
