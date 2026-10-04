import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { PressBtn } from '@/components/PressBtn';
import { ChevronDownCircleIcon, ChevronUpCircleIcon } from '@/components/FigmaIcons';
import { CenteredModal } from './CenteredModal';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { Radius } from '@/constants/spacing';
import { parseLocalDate, fmtDate } from '@/utils/date';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// One tap sets the start date; a second tap on a later date sets the end date and highlights
// everything between (a single continuous pink band with solid circles on the two endpoints) —
// tapping again after a full range starts a new selection instead of extending it, and tapping an
// earlier date than the current start just moves the start there (a receipt/trip is never planned
// backwards, so "the earlier one is start" is always the right read of two taps).
export function DateRangeCalendarModal({
  visible, startDate, endDate, onConfirm, onClose,
}: {
  visible: boolean;
  startDate: string;
  endDate?: string;
  onConfirm: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  useEffect(() => {
    if (!visible) return;
    const s = startDate ? parseLocalDate(startDate) : null;
    const e = endDate ? parseLocalDate(endDate) : null;
    const validStart = s && !isNaN(s.getTime()) ? startOfDay(s) : null;
    const validEnd = e && !isNaN(e.getTime()) ? startOfDay(e) : null;
    setDraftStart(validStart);
    setDraftEnd(validEnd);
    const anchor = validStart ?? new Date();
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
  }, [visible, startDate, endDate]);

  const handleDayPress = (date: Date) => {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(date);
      setDraftEnd(null);
      return;
    }
    if (sameDay(date, draftStart)) return;
    if (date.getTime() < draftStart.getTime()) {
      setDraftStart(date);
      setDraftEnd(null);
    } else {
      setDraftEnd(date);
    }
  };

  const confirm = () => {
    if (!draftStart) { onClose(); return; }
    onConfirm(fmtDate(draftStart), draftEnd ? fmtDate(draftEnd) : '');
  };

  const changeMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <CenteredModal visible={visible} onClose={onClose} padding={0} radius={Radius.xl} showClose={false}>
      <View style={s.header}>
        <PressBtn onPress={onClose}>
          <Text style={s.cancel}>Cancel</Text>
        </PressBtn>
        <Text style={s.title}>Choose date(s)</Text>
        <View style={{ width: 46 }} />
      </View>

      <View style={s.monthNavRow}>
        <PressBtn onPress={() => changeMonth(-1)} hitSlop={8}>
          <View style={{ transform: [{ rotate: '-90deg' }] }}>
            <ChevronUpCircleIcon color={C.text} size={18} />
          </View>
        </PressBtn>
        <Text style={s.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <PressBtn onPress={() => changeMonth(1)} hitSlop={8}>
          <View style={{ transform: [{ rotate: '-90deg' }] }}>
            <ChevronDownCircleIcon color={C.text} size={18} />
          </View>
        </PressBtn>
      </View>

      <View style={s.weekdayRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <View key={i} style={s.dayCell}><Text style={s.weekdayText}>{w}</Text></View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={s.dayCell} />;
            const date = new Date(viewYear, viewMonth, day);
            const isStart = !!draftStart && sameDay(date, draftStart);
            const isEnd = !!draftEnd && sameDay(date, draftEnd);
            const inRange = !!draftStart && !!draftEnd && date.getTime() > draftStart.getTime() && date.getTime() < draftEnd.getTime();
            const isEndpoint = isStart || isEnd;
            const hasRange = !!draftStart && !!draftEnd;
            return (
              <PressBtn key={di} onPress={() => handleDayPress(date)} style={s.dayCell} noShadow>
                {hasRange && (isStart || isEnd || inRange) && (
                  <View
                    style={[
                      s.rangeBand,
                      isStart && !isEnd && { left: '50%' },
                      isEnd && !isStart && { right: '50%' },
                    ]}
                  />
                )}
                {isEndpoint ? (
                  <View style={s.endpointCircle}>
                    <Text style={s.endpointText}>{day}</Text>
                  </View>
                ) : (
                  <Text style={[s.dayText, inRange && s.dayTextInRange]}>{day}</Text>
                )}
              </PressBtn>
            );
          })}
        </View>
      ))}

      <View style={s.footer}>
        <PressBtn onPress={confirm} style={s.doneBtn} disabled={!draftStart}>
          <Text style={[s.done, !draftStart && { color: C.textDim }]}>Done</Text>
        </PressBtn>
      </View>
    </CenteredModal>
  );
}

const CELL_SIZE = 40;

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: C.text },
  cancel: { ...Type.labelMedium, color: C.textSub },
  monthNavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
    paddingTop: 14, paddingBottom: 8,
  },
  monthLabel: { ...Type.cardTitle, color: C.text, minWidth: 150, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 8 },
  weekRow: { flexDirection: 'row', paddingHorizontal: 8 },
  dayCell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  weekdayText: { ...Type.caption, color: C.textDim },
  dayText: { ...Type.labelMedium, color: C.text },
  dayTextInRange: { color: C.tripFg, fontFamily: 'Poppins_600SemiBold' },
  // Spans the full cell width for a day strictly inside the range so adjacent cells' bands touch
  // and read as one continuous strip; the two endpoint cells only fill their inner half so the
  // band visually originates from the center of each solid circle rather than overshooting it.
  rangeBand: { position: 'absolute', top: 4, bottom: 4, left: 0, right: 0, backgroundColor: C.tripBg },
  endpointCircle: {
    width: CELL_SIZE - 8, height: CELL_SIZE - 8, borderRadius: (CELL_SIZE - 8) / 2,
    backgroundColor: C.tripFg, alignItems: 'center', justifyContent: 'center',
  },
  endpointText: { ...Type.labelMedium, fontFamily: 'Poppins_700Bold', color: '#fff' },
  footer: { alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 10 },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  done: { ...Type.button, color: C.primary },
});
