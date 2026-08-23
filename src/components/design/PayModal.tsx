import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, SortIcon } from '@/components/FigmaIcons';
import { PressBtn } from '@/components/PressBtn';
import { C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { fmt, getCurrencySymbol, sanitizeNumberInput } from '@/utils/calculator';
import { fmtDate } from '@/utils/date';
import { selectionHaptic } from '@/utils/haptics';
import { Button } from './Button';
import { CenteredModal } from './CenteredModal';
import { Divider } from './Divider';

/**
 * "Mark as paid" modal shown when tapping a WHO OWES WHO card — one canonical version
 * (trip/[id].tsx is the reference) so every screen that settles up looks and behaves the same.
 */
export function PayModal({ from, to, maxAmount, currency, breakdown, paymentHistory, onClose, onConfirm }: {
  from: string; to: string; maxAmount: number; currency?: string;
  breakdown?: { name: string; amount: number }[];
  paymentHistory?: { amount: number; date: string }[];
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amtStr, setAmtStr] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const parsed = parseFloat(amtStr);
  const sym = getCurrencySymbol(currency ?? 'USD');
  return (
    <CenteredModal
      visible
      onClose={onClose}
      title={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.title, { marginBottom: 0 }]}>{from}</Text>
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <SortIcon size={14} color={C.textSub} />
          </View>
          <Text style={[s.title, { marginBottom: 0 }]}>{to}</Text>
        </View>
      }
    >
      {!!breakdown?.length && (
        <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
          {breakdown.map((b, j) => (
            <View key={j} style={s.lineRow}>
              <Text style={s.lineName} numberOfLines={1}>{b.name}</Text>
              <Text style={s.lineAmt}>{fmt(b.amount, currency)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
      <Divider style={s.divider} />
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total</Text>
        <Text style={s.totalAmt}>{fmt(maxAmount, currency)}</Text>
      </View>
      <Button
        variant="primary" size="small" label="Paid" icon={<CheckCircleIcon color={C.text} size={13} />}
        onPress={() => onConfirm(maxAmount)}
        style={{ backgroundColor: C.billBg }}
      />
      <View style={s.expandActions}>
        <View style={[s.partialRow, { flex: 1 }]}>
          <Text style={s.partialSign}>{sym}</Text>
          <TextInput
            style={[s.partialInput, { outlineWidth: 0 } as any]}
            value={amtStr}
            onChangeText={(v) => setAmtStr(sanitizeNumberInput(v))}
            keyboardType="decimal-pad"
            placeholder="Partial"
            placeholderTextColor={C.textDim}
          />
        </View>
        <Button
          variant="secondary" size="small" label="Pay partial"
          onPress={() => { if (parsed > 0) onConfirm(Math.min(parsed, maxAmount)); }}
          disabled={!(parsed > 0)}
          style={{ flex: 1 }}
        />
      </View>
      {!!paymentHistory?.length && (
        <View>
          <PressBtn style={s.historyHeader} onPress={() => { selectionHaptic(); setHistoryOpen((o) => !o); }} activeOpacity={1} noShadow>
            <Text style={s.historyLabel}>Payment history ({paymentHistory.length})</Text>
            {historyOpen
              ? <ChevronUpCircleIcon color={C.textSub} size={14} />
              : <ChevronDownCircleIcon color={C.textSub} size={14} />}
          </PressBtn>
          {historyOpen && paymentHistory.map((p, j) => (
            <View key={j} style={s.lineRow}>
              <Text style={s.lineName}>{fmtDate(p.date)}</Text>
              <Text style={s.lineAmt}>{fmt(p.amount, currency)}</Text>
            </View>
          ))}
        </View>
      )}
    </CenteredModal>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: 'Poppins_900Black', fontSize: 20, color: C.text, marginBottom: 4 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  lineName: { flex: 1, color: C.text, fontFamily: 'Poppins_400Regular', fontSize: 13 },
  lineAmt: { color: C.text, fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  divider: { backgroundColor: C.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  totalLabel: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.text },
  totalAmt: { fontFamily: 'Poppins_900Black', fontSize: 18, color: C.text },
  expandActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  partialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 12 },
  partialSign: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: C.textSub },
  partialInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text, padding: 0 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4 },
  historyLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: C.textSub },
});
