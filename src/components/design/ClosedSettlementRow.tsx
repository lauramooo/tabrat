import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from 'react-native-paper';
import { ActionPill } from '@/components/ActionPill';
import { Avatar } from '@/components/Avatar';
import { CheckCircleIcon, ReopenIcon } from '@/components/FigmaIcons';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { fmt } from '@/utils/calculator';
import { Card } from './Card';

/**
 * A settled "who owes who" row (shown under PAID) — tap or swipe to reopen it.
 * One canonical version (trip/[id].tsx is the reference) so every screen with a settlement
 * list looks and behaves the same.
 */
export function ClosedSettlementRow({ txn, avatarIdx, scopePerson, myName, currency, onReopen, onSwipeOpen }: {
  txn: { from: string; to: string; amount: number };
  avatarIdx: number;
  /** '' = everyone (no scope) */
  scopePerson: string;
  myName: string;
  currency?: string;
  onReopen: () => void;
  onSwipeOpen: (ref: Swipeable) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const isSend = !scopePerson || txn.from === scopePerson;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={(progress) => (
        <ActionPill progress={progress} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.homeBg}
          onPress={() => { swipeRef.current?.close(); onReopen(); }} />
      )}
      overshootRight={false} friction={2} rightThreshold={40}
      onSwipeableOpen={() => { if (swipeRef.current) onSwipeOpen(swipeRef.current); }}
    >
      <Card
        style={s.cardClosed}
        onPress={onReopen}
        pressBorderColor={scopePerson ? C.success : AVATAR_PALETTE[avatarIdx % AVATAR_PALETTE.length].bg}
      >
        {!scopePerson ? (
          <Avatar name={txn.from} index={avatarIdx} size={36} />
        ) : (
          <View style={[s.payCircle, { backgroundColor: C.success + '18' }]}>
            <CheckCircleIcon color={C.success} size={16} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.titleRow}>
            {scopePerson ? (
              <Text style={[s.title, s.closedTitle, { flex: 1 }]} numberOfLines={1}>{isSend ? txn.to : txn.from}</Text>
            ) : (
              <Text style={[s.title, s.closedTitle, { flex: 1 }]} numberOfLines={1}>{txn.from}{txn.from === myName ? ' (me)' : ''}</Text>
            )}
            <View style={s.paidRow}>
              <CheckCircleIcon color={C.success} size={13} />
              <Text style={s.paidText}>{fmt(txn.amount, currency)}</Text>
            </View>
          </View>
          <Text style={s.desc} numberOfLines={1}>
            {scopePerson ? (isSend ? 'you owed' : 'owed you') : `paid ${txn.to}`}
          </Text>
        </View>
      </Card>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  cardClosed: { opacity: 0.5 },
  payCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  closedTitle: { color: C.textDim },
  desc: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -2 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, textDecorationLine: 'line-through' },
});
