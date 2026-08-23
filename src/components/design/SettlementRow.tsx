import { StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from 'react-native-paper';
import { useRef } from 'react';
import { ActionPill } from '@/components/ActionPill';
import { Avatar } from '@/components/Avatar';
import { CheckCircleIcon, SortIcon } from '@/components/FigmaIcons';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { fmt } from '@/utils/calculator';
import { Card } from './Card';

/**
 * An open "who owes who" row — tap to open the pay modal, swipe to mark fully paid.
 * One canonical version (trip/[id].tsx is the reference) so every screen with a settlement
 * list looks and behaves the same.
 */
export function SettlementRow({ txn, avatarIdx, scopePerson, myName, currency, paidSoFar, onPress, onMarkPaid, onSwipeOpen }: {
  txn: { from: string; to: string; amount: number };
  avatarIdx: number;
  /** '' = everyone (no scope) */
  scopePerson: string;
  myName: string;
  currency?: string;
  paidSoFar: number;
  onPress: () => void;
  onMarkPaid: () => void;
  onSwipeOpen: (ref: Swipeable) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const isSend = !scopePerson || txn.from === scopePerson;
  const dirColor = scopePerson ? (isSend ? C.error : C.success) : C.textDim;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={(progress) => (
        <ActionPill progress={progress} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.billBg}
          onPress={() => { swipeRef.current?.close(); onMarkPaid(); }} />
      )}
      overshootRight={false} friction={2} rightThreshold={40}
      onSwipeableOpen={() => { if (swipeRef.current) onSwipeOpen(swipeRef.current); }}
    >
      <Card onPress={onPress} pressBorderColor={scopePerson ? dirColor : AVATAR_PALETTE[avatarIdx % AVATAR_PALETTE.length].bg}>
        {!scopePerson ? (
          <Avatar name={txn.from} index={avatarIdx} size={36} />
        ) : (
          <View style={[s.payCircle, { backgroundColor: dirColor + '18' }]}>
            <View style={{ transform: [{ rotate: isSend ? '90deg' : '-90deg' }] }}>
              <SortIcon size={14} color={dirColor} />
            </View>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={s.titleRow}>
            {scopePerson ? (
              <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>{isSend ? txn.to : txn.from}</Text>
            ) : (
              <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>{txn.from}{txn.from === myName ? ' (me)' : ''}</Text>
            )}
            <Text style={[s.total, scopePerson && { color: dirColor }]}>{fmt(txn.amount, currency)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ transform: [{ rotate: (!scopePerson || isSend) ? '90deg' : '-90deg' }] }}>
              <SortIcon size={10} color={C.textSub} />
            </View>
            <Text style={s.desc} numberOfLines={1}>
              {scopePerson ? (isSend ? 'you owe' : 'owes you') : `pay ${txn.to}`}
            </Text>
          </View>
          {paidSoFar > 0 && (
            <View style={s.paidRow}>
              <CheckCircleIcon color={C.success} size={13} />
              <Text style={s.paidText}>{fmt(paidSoFar, currency)} paid</Text>
            </View>
          )}
        </View>
      </Card>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  payCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  total: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.text },
  desc: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: -2 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: C.textSub, textDecorationLine: 'line-through' },
});
