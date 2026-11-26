import { StyleSheet, View } from 'react-native';
import { AlertIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import type { SplitRecord } from '@/types';
import { Card } from './Card';
import { IconBadge } from './IconBadge';
import { Text } from './Text';

// Expenses with no payer can't be settled, so "who owes who" leaves them out entirely — this
// says so out loud on the trip/home dashboard instead of the totals silently not adding up.
// Shared by trip/[id].tsx and home/[id].tsx.
export function MissingPayerNotice({ expenses, onOpen }: {
  expenses: SplitRecord[];
  onOpen: (expense: SplitRecord) => void;
}) {
  if (expenses.length === 0) return null;
  return (
    <View style={s.wrap}>
      {expenses.map((e) => (
        <Card key={e.id} onPress={() => onOpen(e)} pressBorderColor={C.error}>
          <IconBadge bg={C.error}><AlertIcon size={16} color={C.errorFg} /></IconBadge>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{`${e.restaurantName || 'A bill'} has no payer`}</Text>
            <Text style={s.desc}>{"It's not in who owes who yet. Tap to pick who paid."}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  title: { ...Type.cardTitle, color: C.text },
  desc: { ...Type.cardDesc, color: C.textSub },
});
