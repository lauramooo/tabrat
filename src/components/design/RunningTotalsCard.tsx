import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Avatar } from '@/components/Avatar';
import { C } from '@/constants/colors';
import { fmt } from '@/utils/calculator';
import { Card } from './Card';
import { Divider } from './Divider';

/**
 * The avatar + name + amount list shown under "RUNNING TOTALS" — one canonical version so a
 * style change (trip/[id].tsx is the reference) applies to every screen that uses it.
 */
export function RunningTotalsCard({ people, currency }: {
  people: { name: string; amount: number }[];
  currency?: string;
}) {
  return (
    <Card padding={0} row={false} style={[s.card, { marginTop: 10 }]}>
      {people.map((p, i) => (
        <View key={p.name}>
          {i > 0 && <Divider />}
          <View style={s.row}>
            <Avatar name={p.name} index={i} size={32} />
            <Text style={s.name}>{p.name}</Text>
            <Text style={s.amount}>{fmt(p.amount, currency)}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  name: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 14, color: C.text },
  amount: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
});
