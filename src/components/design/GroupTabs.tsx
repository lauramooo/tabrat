import { StyleSheet, View } from 'react-native';
import { Button } from './Button';

export type GroupTab = 'dashboard' | 'expenses';

// The Dashboard | Expenses switch at the top of a trip or home — the same pill chips as the
// Feed's filter row, so it reads as "two views of this trip" rather than a button that opens a
// new page. Shared by trip/[id], trip/expenses, home/[id], and home/expenses.
export function GroupTabs({ active, onSelect }: { active: GroupTab; onSelect: (tab: GroupTab) => void }) {
  return (
    <View style={s.row}>
      <Button variant="filter" size="small" active={active === 'dashboard'} label="Dashboard"
        onPress={() => { if (active !== 'dashboard') onSelect('dashboard'); }} />
      <Button variant="filter" size="small" active={active === 'expenses'} label="Expenses"
        onPress={() => { if (active !== 'expenses') onSelect('expenses'); }} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
});
