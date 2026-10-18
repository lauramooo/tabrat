import { StyleSheet, View } from 'react-native';

import { AvatarStrip } from '@/components/AvatarStrip';
import { ScreenHeaderTitle, ScreenSubHeader } from '@/components/FlowSteps';
import { CircleIconButton, GroupTabs, type GroupTab } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { fmtDate } from '@/utils/date';
import { Text } from '@/components/design/Text';

// The top of a trip or home: name, a subtitle line, member avatars, then the Dashboard | Expenses
// chips. Shared by all four tab screens. The subtitle and avatar rows are fixed-height slots
// (reserved even when empty) so the chips sit at exactly the same spot on every tab and every
// trip/home — whether there's a date range, a month picker, nothing, or no members yet.
export function GroupHeader({ name, date, endDate, subtitle, people, active, onSelectTab }: {
  name: string;
  /** Trip date range — shown in the subtitle slot when no custom `subtitle` is given. */
  date?: string;
  endDate?: string;
  /** Custom subtitle content (e.g. the home dashboard's month picker). */
  subtitle?: React.ReactNode;
  people: string[];
  active: GroupTab;
  onSelectTab: (tab: GroupTab) => void;
}) {
  const dateText = date ? `${fmtDate(date) || date}${endDate ? ` – ${fmtDate(endDate) || endDate}` : ''}` : '';
  return (
    <>
      <ScreenSubHeader>
        <ScreenHeaderTitle name={name} reserveDateSlot={false}>
          <View style={s.subtitleSlot}>
            {subtitle ?? (dateText ? <Text style={s.date}>{dateText}</Text> : null)}
          </View>
        </ScreenHeaderTitle>
      </ScreenSubHeader>
      <View style={s.avatarSlot}>
        <AvatarStrip names={people} />
      </View>
      <GroupTabs active={active} onSelect={onSelectTab} />
    </>
  );
}

// "‹ Oct 2026 ›" — a home's month picker, shown in GroupHeader's subtitle slot on both its tabs.
export function HeaderMonthPicker({ label, onPrev, onNext, nextDisabled }: {
  label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean;
}) {
  return (
    <View style={s.monthRow}>
      <CircleIconButton variant="back" size={20} color={C.primary} onPress={onPrev} hitSlop={10} />
      <Text style={s.date}>{label}</Text>
      <CircleIconButton variant="back" size={20} color={nextDisabled ? C.textDim : C.primary} onPress={onNext}
        disabled={nextDisabled} hitSlop={10} style={{ transform: [{ rotate: '180deg' }] }} />
    </View>
  );
}

const s = StyleSheet.create({
  // Tall enough for the month picker's 20px arrow buttons, so a plain date line takes the same room.
  subtitleSlot: { height: 26, justifyContent: 'center', alignItems: 'center' },
  date: { ...Type.cardDesc, color: C.textSub },
  avatarSlot: { height: 22 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
