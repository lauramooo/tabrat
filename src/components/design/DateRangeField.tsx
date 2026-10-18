import { useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { PressBtn } from '@/components/PressBtn';
import { CalendarIcon, CloseCircleIcon } from '@/components/FigmaIcons';
import { DateRangeCalendarModal } from './DateRangeCalendarModal';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { InputMetrics } from '@/constants/spacing';
import { fmtDateRange } from '@/utils/date';

// The single combined "when" field (trip dates, trip/home expense dates): one box reading
// "Oct. 14, 2026" or "Oct. 14-17, 2026", opening the blue-to-pink range calendar on tap.
// An empty endDate means a single day.
export function DateRangeField({
  startDate, endDate, onChange, placeholder = 'Choose date(s)', clearable = true, style,
}: {
  startDate: string;
  endDate?: string;
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  clearable?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressBtn style={[s.box, style]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <CalendarIcon size={15} color={C.text} />
        <Text style={[s.text, !startDate && { color: C.textDim }]} numberOfLines={1}>
          {startDate ? fmtDateRange(startDate, endDate) : placeholder}
        </Text>
        {clearable && startDate ? (
          <PressBtn onPress={() => onChange('', '')} hitSlop={10}>
            <CloseCircleIcon size={15} color={C.textDim} />
          </PressBtn>
        ) : null}
      </PressBtn>
      <DateRangeCalendarModal
        visible={open}
        startDate={startDate}
        endDate={endDate}
        onConfirm={(st, en) => { onChange(st, en); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 14 },
  text: { flex: 1, minWidth: 0, ...Type.bodySmall, color: C.text },
});
