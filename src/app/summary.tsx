import { useRouter } from 'expo-router';
import { PressBtn } from '@/components/PressBtn';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Portal, Snackbar } from 'react-native-paper';
import { ActionPill } from '@/components/ActionPill';
import { Avatar } from '@/components/Avatar';
import { Button, Card, CenteredModal, CircleIconButton, Divider, Dropdown, DropdownRow, ModalBackdrop } from '@/components/design';
import { CheckCircleIcon, ChevronDownCircleIcon, ChevronUpCircleIcon, ReopenIcon, SendIcon } from '@/components/FigmaIcons';
import { captureRef } from 'react-native-view-shot';
import { BillHeader, FlowSteps } from '@/components/FlowSteps';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { useSplitStore } from '@/store/useSplitStore';
import { itemDetailLabels } from '@/utils/items';
import { calculateSplits, fmt } from '@/utils/calculator';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { fmtDate } from '@/utils/date';
import { lightHaptic, mediumHaptic, successHaptic } from '@/utils/haptics';
import { shareText } from '@/utils/share';
import type { Person, PersonSplit } from '@/types';
import { Text } from '@/components/design/Text';
import { joinInviteMessage } from '@/utils/joinCode';

const PERSON_COLORS = AVATAR_PALETTE;

// -- Receipt torn-edge decoration -----------------------------------------------

const TOOTH_HEIGHT = 9;
const SHARE_CARD_WIDTH = 360;

// A row of white triangular "teeth" tapering to points away from the card, so the cream page
// shows through the gaps between them — reads as the card's own edge being torn rather than a
// separate shape sitting on it. Pre-baked as a fully OPAQUE 360x9 PNG (cream baked directly into
// the "notch" pixels, not left transparent) rather than drawn at runtime with SVG/border tricks:
// react-native-view-shot's web capture silently drops border-triangle Views, react-native-svg
// content, AND transparent-PNG <Image>s alike when rasterizing — plain opaque pixels are the one
// thing that survives that capture reliably (confirmed by testing a flat opaque-color View, which
// captures fine), so this trades a hardcoded background color for something that actually renders.
const ZIGZAG_TOP_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAAJCAYAAAAfOraeAAAAgElEQVR42u3UMQqAMAwF0Nz/pK5ubjo5ljY2BaHvw9/Ka7IkrvO4VVX1f43M4zerhuHz+Xx+8kC3Uj04n8/n8xMHupdVw/P5fP7ufszgs0vw+Xw+P3mgv6Z6cD6fz9/Zjyp8dAk+n8/nj/lRifeW4PP5fP64H5Vw6yM+n8/n5/0HmQE64J5lKxgAAAAASUVORK5CYII=';
const ZIGZAG_BOTTOM_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAAJCAYAAAAfOraeAAAAg0lEQVR42u3UMQqAQAwEwPz/pbZ2doqFIMLpeYlgMQtpZ7dKrCIi8svEMk+f4bvN5/P5/DE/jpLKorPJ5/P5/DE/qkta4/l8Pp//zo/KkqfxfD6fz+/3o6Kodzifz+fz+/3IloyO5/P5fP6Ue9B3JdnxfD6fz08+6GtR1XA+n8/nt28DQqJ4wLG9tb0AAAAASUVORK5CYII=';

function ReceiptZigzagEdge({ flip = false }: { flip?: boolean }) {
  return (
    <Image
      source={{ uri: flip ? ZIGZAG_BOTTOM_URI : ZIGZAG_TOP_URI }}
      style={{ width: SHARE_CARD_WIDTH, height: TOOTH_HEIGHT }}
      resizeMode="stretch"
    />
  );
}

// -- Share image modal ---------------------------------------------------------

function ShareCardContent({ splits, total, restaurantName, date, mode, colorOffset = 0, joinCode }: {
  splits: PersonSplit[]; total: number; restaurantName?: string; date?: string; mode: 'short' | 'full'; colorOffset?: number; joinCode?: string;
}) {
  return (
    <>
      {(!!restaurantName || !!joinCode) && (
        <View style={{ alignItems: 'center', marginBottom: 4 }}>
          {!!restaurantName && <Text style={st.shareCardTitle}>{restaurantName}</Text>}
          {!!date && <Text style={st.shareCardDate}>{fmtDate(date) || date}</Text>}
          {!!joinCode && <Text style={st.shareCardCode}>Tab Rat share code: {joinCode}</Text>}
        </View>
      )}
      {splits.map((s, i) => (
        <View key={s.person.id}>
          <View style={st.shareRow}>
            <Avatar name={s.person.name} index={colorOffset + i} size={32} twoLetter />
            <Text style={st.sharePersonName}>{s.person.name}</Text>
            {mode === 'short' && <Text style={st.sharePersonTotal}>{fmt(s.total)}</Text>}
          </View>
          {mode === 'full' && s.itemShares.length > 0 && (
            <View style={st.shareItems}>
              {s.itemShares.map(({ item, share }) => (
                <View key={item.id}>
                  <View style={st.lineRow}>
                    <Text style={st.lineName} numberOfLines={1}>{item.name}</Text>
                    {item.assignedTo.length > 1 && (
                      <View style={st.lineSplitBadge}>
                        <Text style={st.lineSplitText}>÷{item.assignedTo.length}</Text>
                      </View>
                    )}
                    <Text style={st.lineAmt}>{fmt(share)}</Text>
                  </View>
                  {itemDetailLabels(item).length > 0 && (
                    <Text style={st.lineModifiers} numberOfLines={1}>{itemDetailLabels(item).join(', ')}</Text>
                  )}
                </View>
              ))}
              <Divider style={st.divider} />
              {s.taxShare > 0 && (
                <View style={st.lineRow}>
                  <Text style={[st.lineName, { color: C.textSub }]}>Tax</Text>
                  <Text style={[st.lineAmt, { color: C.textSub }]}>{fmt(s.taxShare)}</Text>
                </View>
              )}
              {s.tipShare > 0 && (
                <View style={st.lineRow}>
                  <Text style={[st.lineName, { color: C.textSub }]}>Tip</Text>
                  <Text style={[st.lineAmt, { color: C.textSub }]}>{fmt(s.tipShare)}</Text>
                </View>
              )}
              <View style={st.modalTotalRow}>
                <Text style={st.modalTotalLabel}>Total</Text>
                <Text style={st.modalTotalAmt}>{fmt(s.total)}</Text>
              </View>
            </View>
          )}
          {i < splits.length - 1 && <View style={st.shareSep} />}
        </View>
      ))}
      {splits.length > 1 && (
        <>
          <Divider style={[st.divider, { marginTop: 12 }]} />
          <View style={[st.modalTotalRow, { marginTop: 2 }]}>
            <Text style={st.modalTotalLabel}>Bill total</Text>
            <Text style={st.modalTotalAmt}>{fmt(total)}</Text>
          </View>
        </>
      )}
    </>
  );
}

type ShareMode = 'short' | 'full';

// Gives up on an image after this long and falls back to sharing text, rather than leaving the
// sheet on "Generating preview…" forever.
const CAPTURE_TIMEOUT_MS = 12000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

// Plain-text version of the share card — the fallback when the image can't be made.
function splitsAsText(splits: PersonSplit[], total: number, mode: ShareMode, restaurantName?: string, date?: string) {
  const header = [restaurantName || 'Bill summary', date ? fmtDate(date) || date : ''].filter(Boolean).join(' — ');
  const people = splits.map((s) => {
    const line = `${s.person.name}: ${fmt(s.total)}`;
    if (mode === 'short' || s.itemShares.length === 0) return line;
    const items = s.itemShares.map(({ item, share }) => `  • ${item.name} ${fmt(share)}`);
    const extras = [s.taxShare > 0 ? `  • Tax ${fmt(s.taxShare)}` : '', s.tipShare > 0 ? `  • Tip ${fmt(s.tipShare)}` : ''].filter(Boolean);
    return [line, ...items, ...extras].join('\n');
  });
  return [header, '', ...people, '', `Total: ${fmt(total)}`].join('\n');
}

function ShareImageModal({ splits, total, restaurantName, date, colorOffset, joinCode, onClose }: {
  splits: PersonSplit[];
  total: number;
  restaurantName?: string;
  date?: string;
  colorOffset?: number;
  joinCode?: string;
  onClose: () => void;
}) {
  const isSinglePerson = splits.length === 1;
  const [mode, setMode] = useState<ShareMode>(isSinglePerson ? 'full' : 'short');
  // Both versions are rendered off-screen and captured once each (short first, since it's the
  // default), so switching Short/Full is instant instead of regenerating every time.
  const shortRef = useRef<View>(null);
  const fullRef = useRef<View>(null);
  const [cardSize, setCardSize] = useState<Partial<Record<ShareMode, { w: number; h: number }>>>({});
  const [shots, setShots] = useState<Partial<Record<ShareMode, string>>>({});
  const [failed, setFailed] = useState<Partial<Record<ShareMode, boolean>>>({});
  const [codeCopied, setCodeCopied] = useState(false);
  const capturing = useRef<Partial<Record<ShareMode, boolean>>>({});

  const capture = async (m: ShareMode) => {
    const ref = m === 'short' ? shortRef : fullRef;
    if (capturing.current[m] || !ref.current) return;
    capturing.current[m] = true;
    try {
      // Let the freshly laid-out card actually draw before snapshotting it.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      // renderInContext: the default snapshot method silently fails (or comes back blank) on
      // large off-screen views — exactly the tall card a big group makes.
      const uri = await withTimeout(
        captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', useRenderInContext: true }),
        CAPTURE_TIMEOUT_MS,
      );
      setShots((s) => ({ ...s, [m]: uri }));
    } catch (e) {
      console.log('[summary] captureRef failed:', e);
      setFailed((f) => ({ ...f, [m]: true }));
    }
  };

  // Capture once each card has laid out: the current mode first, then the other in the background.
  useEffect(() => {
    if (cardSize[mode] && !shots[mode] && !failed[mode]) { capture(mode); return; }
    const other: ShareMode = mode === 'short' ? 'full' : 'short';
    if (!isSinglePerson && cardSize[other] && !shots[other] && !failed[other]) capture(other);
  }, [cardSize, shots, failed, mode]);

  const onCardLayout = (m: ShareMode) => (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0 && !cardSize[m]) setCardSize((s) => ({ ...s, [m]: { w, h } }));
  };

  const previewUri = shots[mode];
  const size = cardSize[mode];
  const imgRatio = size ? size.w / size.h : 1.4;

  const handleShareCode = async () => {
    if (!joinCode) return;
    mediumHaptic();
    const didCopy = await shareText(joinInviteMessage('bill', joinCode));
    if (didCopy) {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const shareAsText = () => Share.share({ message: splitsAsText(splits, total, mode, restaurantName, date) });

  const doShare = async () => {
    mediumHaptic();
    if (!previewUri) { await shareAsText(); return; }
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = previewUri;
      a.download = 'bill-summary.png';
      a.click();
      return;
    }
    try {
      await Share.share({ url: previewUri });
    } catch {
      await shareAsText();
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* Off-screen capture targets, one per mode */}
      <View style={{ position: 'absolute', left: -9999, top: 0, width: 360, backgroundColor: C.bg }}>
        {(isSinglePerson ? (['full'] as const) : (['short', 'full'] as const)).map((m) => (
          <View key={m} ref={m === 'short' ? shortRef : fullRef} collapsable={false} onLayout={onCardLayout(m)}>
            <ReceiptZigzagEdge />
            <View style={[st.shareCard, { borderRadius: 0 }]}>
              <ShareCardContent splits={splits} total={total} restaurantName={restaurantName} date={date} mode={m} colorOffset={colorOffset} joinCode={joinCode} />
            </View>
            <ReceiptZigzagEdge flip />
          </View>
        ))}
      </View>

      <ModalBackdrop style={st.modalBackdrop} onPress={onClose}>
        <Pressable style={[st.modalCard, { padding: 20, gap: 14, maxHeight: '85%' }]} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={st.modalTitle}>Share summary</Text>
            <CircleIconButton variant="close" size={20} color={C.text} onPress={onClose} />
          </View>

          {!isSinglePerson && (
            <View style={st.modeToggle}>
              <Button variant="filter" size="small" active={mode === 'short'} label="Short" onPress={() => { lightHaptic(); setMode('short'); }} />
              <Button variant="filter" size="small" active={mode === 'full'} label="Full" onPress={() => { lightHaptic(); setMode('full'); }} />
            </View>
          )}

          {/* Scrollable image preview — right-click on web copies the image. minHeight (not just
              flex:1) matters here: modalCard sizes itself to its content up to maxHeight rather
              than always filling it, so a flex:1 child with nothing stretching its parent to a
              definite height collapses toward zero and neither the image nor the placeholder text
              below was ever visible. */}
          <ScrollView style={{ flex: 1, minHeight: 280 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={{ width: '100%', aspectRatio: imgRatio, borderRadius: 12 }}
                resizeMode="contain"
              />
            ) : (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <Text style={{ color: C.textSub, fontFamily: 'Poppins_400Regular', textAlign: 'center' }}>
                  {failed[mode] ? "Couldn't make the image — Share will send the split as text instead." : 'Generating preview…'}
                </Text>
              </View>
            )}
          </ScrollView>

          {!!joinCode && (
            <PressBtn style={st.imgModalCodeRow} onPress={handleShareCode} activeOpacity={0.7}>
              <Text style={st.codeRowLabel}>CODE</Text>
              <Text style={st.codeRowValue}>{joinCode}</Text>
              <Text style={st.codeRowAction}>{codeCopied ? 'Copied!' : 'Share'}</Text>
            </PressBtn>
          )}

          <Button
            variant="primary"
            size="small"
            label={failed[mode] && !previewUri ? 'Share as text' : 'Share image'}
            icon={<SendIcon color={C.text} size={17} />}
            onPress={doShare}
            disabled={!previewUri && !failed[mode]}
            style={{ alignSelf: 'flex-end' }}
          />
        </Pressable>
      </ModalBackdrop>
    </Modal>
  );
}


// -- Person card ---------------------------------------------------------------

function PersonCard({ split, index, color, payer, paid, isPayer, onOpenDetail, onMarkPaid, onShare }: {
  split: PersonSplit;
  index: number;
  color: { bg: string; text: string };
  payer: Person | null;
  paid: boolean;
  isPayer: boolean;
  onOpenDetail: () => void;
  onMarkPaid: () => void;
  onShare: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const owes = payer && payer.id !== split.person.id;
  const subtitle = owes
    ? `Pay ${payer!.name}`
    : isPayer
      ? 'Paid the bill'
      : split.itemShares.length > 0
        ? `${split.itemShares.length} item${split.itemShares.length === 1 ? '' : 's'}`
        : null;

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={(progress) => (
        <View style={{ flexDirection: 'row' }}>
          {!isPayer && (
            paid ? (
              <ActionPill progress={progress} iconNode={(c) => <ReopenIcon color={c} size={15} />} label="Reopen" color={C.homeBg}
                onPress={() => { lightHaptic(); swipeRef.current?.close(); onMarkPaid(); }} />
            ) : (
              <ActionPill progress={progress} iconNode={(c) => <CheckCircleIcon color={c} size={15} />} label="Paid" color={C.billBg}
                onPress={() => { lightHaptic(); swipeRef.current?.close(); onMarkPaid(); }} />
            )
          )}
          <ActionPill progress={progress} iconNode={(c) => <SendIcon color={c} size={15} />} label="Share" color={C.homeBg}
            onPress={() => { swipeRef.current?.close(); onShare(); }} />
        </View>
      )}
    >
      <Card
        onPress={onOpenDetail}
        pressBorderColor={color.bg}
        style={[paid && st.feedCardClosed, { flex: 1 }]}
      >
        <Avatar name={split.person.name} index={index} twoLetter />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={st.titleRow}>
            <Text style={[st.feedTitle, paid && st.closedTitle, { flex: 1 }]} numberOfLines={1}>
              {split.person.name}
            </Text>
            {paid ? (
              <View style={st.paidAmountRow}>
                <CheckCircleIcon color={C.success} size={13} />
                <Text style={st.paidAmountText}>{fmt(split.total)}</Text>
              </View>
            ) : (
              <Text style={st.feedTotal}>{fmt(split.total)}</Text>
            )}
          </View>
          {!!subtitle && <Text style={st.feedDesc} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </Card>
    </Swipeable>
  );
}

// -- Person detail modal (item breakdown + total + share/pay) ------------------

function PersonDetailModal({ split, index, payer, paid, isPayer, onClose, onMarkPaid, onShare }: {
  split: PersonSplit | null;
  index: number;
  payer: Person | null;
  paid: boolean;
  isPayer: boolean;
  onClose: () => void;
  onMarkPaid: () => void;
  onShare: () => void;
}) {
  if (!split) return null;
  const owes = payer && payer.id !== split.person.id;
  const subtitle = owes ? `Pay ${payer!.name}` : isPayer ? 'Paid the bill' : null;

  return (
    <CenteredModal
      visible={!!split}
      onClose={onClose}
      title={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={split.person.name} index={index} size={32} fontSize={12} twoLetter />
          <View style={{ flex: 1 }}>
            <Text style={st.modalPersonName} numberOfLines={1}>{split.person.name}</Text>
            {!!subtitle && <Text style={st.modalPersonSub}>{subtitle}</Text>}
          </View>
        </View>
      }
    >
      <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
        {split.itemShares.map(({ item, share }) => (
          <View key={item.id}>
            <View style={st.lineRow}>
              <Text style={st.lineName} numberOfLines={1}>{item.name}</Text>
              {item.assignedTo.length > 1 && (
                <View style={st.lineSplitBadge}>
                  <Text style={st.lineSplitText}>÷{item.assignedTo.length}</Text>
                </View>
              )}
              <Text style={st.lineAmt}>{fmt(share)}</Text>
            </View>
            {itemDetailLabels(item).length > 0 && (
              <Text style={st.lineModifiers} numberOfLines={1}>{itemDetailLabels(item).join(', ')}</Text>
            )}
          </View>
        ))}
      </ScrollView>

      <Divider style={st.divider} />

      <View style={{ gap: 2 }}>
        {split.taxShare > 0 && (
          <View style={st.lineRow}>
            <Text style={[st.lineName, { color: C.textSub }]}>Tax</Text>
            <Text style={[st.lineAmt, { color: C.textSub }]}>{fmt(split.taxShare)}</Text>
          </View>
        )}
        {split.tipShare > 0 && (
          <View style={st.lineRow}>
            <Text style={[st.lineName, { color: C.textSub }]}>Tip</Text>
            <Text style={[st.lineAmt, { color: C.textSub }]}>{fmt(split.tipShare)}</Text>
          </View>
        )}
        <View style={st.modalTotalRow}>
          <Text style={st.modalTotalLabel}>Total</Text>
          <Text style={st.modalTotalAmt}>{fmt(split.total)}</Text>
        </View>
      </View>

      <View style={st.expandActions}>
        <Button variant="secondary" size="small" label="Share" icon={<SendIcon color={C.text} size={13} />} onPress={onShare} style={{ flex: 1, backgroundColor: C.homeBg }} />
        {!isPayer && (
          paid ? (
            <Button variant="secondary" size="small" label="Reopen" icon={<ReopenIcon color={C.text} size={13} />} onPress={onMarkPaid} style={{ flex: 1, backgroundColor: C.homeBg }} />
          ) : (
            <Button variant="primary" size="small" label="Paid" icon={<CheckCircleIcon color={C.text} size={13} />} onPress={() => { onMarkPaid(); onClose(); }} style={{ flex: 1, backgroundColor: C.billBg }} />
          )
        )}
      </View>
    </CenteredModal>
  );
}

// -- Screen --------------------------------------------------------------------

export default function SummaryScreen() {
  const router = useRouter();
  const { items, people, tax, tip, extraCharges, paidBy, reset, saveSplit, activeTripId, setActiveTripId, restaurantName, receiptDate, savedSplitId, deleteHistory, setPaidBy, history, setPersonPaid } = useSplitStore();
  const payer = paidBy ? people.find((p) => p.id === paidBy) ?? null : null;
  const paymentStatuses = (savedSplitId ? history.find((r) => r.id === savedSplitId)?.paymentStatuses : undefined) ?? [];
  const isPersonPaid = (personId: string) => paymentStatuses.find((ps) => ps.personId === personId)?.paid === true;
  const savedRef = useRef(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [shareImageVisible, setShareImageVisible] = useState(false);
  const joinCode = savedSplitId ? history.find((r) => r.id === savedSplitId)?.joinCode : undefined;
  const [sharePerson, setSharePerson] = useState<{ split: PersonSplit; colorIdx: number } | null>(null);
  const [detailPerson, setDetailPerson] = useState<{ split: PersonSplit; colorIdx: number } | null>(null);
  const payerBtnRef = useRef<PressBtn>(null);
  const [payerDropOpen, setPayerDropOpen] = useState(false);
  const [payerDropPos, setPayerDropPos] = useState<{ top: number; right: number } | null>(null);

  const extraTotal = extraCharges.reduce((s, c) => s + c.amount, 0);
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const total = subtotal + tax + tip + extraTotal;

  const myName = useMyName();
  const sortedPeople = sortWithMeFirst(people, myName);
  const splits = useMemo(
    () => {
      const lo = myName?.toLowerCase();
      const raw = calculateSplits(items, people, tax, tip, extraTotal);
      return [...raw].sort((a, b) => {
        if (lo && a.person.name.toLowerCase() === lo) return -1;
        if (lo && b.person.name.toLowerCase() === lo) return 1;
        return a.person.name.localeCompare(b.person.name);
      });
    },
    [items, people, tax, tip, extraTotal, myName],
  );

  useEffect(() => {
    if (!savedRef.current && items.length > 0) {
      savedRef.current = true;
      saveSplit();
      successHaptic();
      setSnackVisible(true);
    }
  }, []);

  const handleDone = () => {
    mediumHaptic();
    const tid = activeTripId;
    setActiveTripId(null);
    reset();
    if (tid) {
      router.dismissAll();
      router.push({ pathname: '/trip/[id]', params: { id: tid } });
    } else {
      router.dismissAll();
    }
  };

  return (
    <SafeAreaView style={st.safe} edges={['bottom']}>
      <BillHeader />
      <FlowSteps active={3} />
      <View style={st.totalBanner}>
        <View>
          <Text style={st.totalLabel}>BILL TOTAL</Text>
          <Text style={st.totalAmt}>{fmt(total)}</Text>
        </View>
        <PressBtn
          ref={payerBtnRef}
          style={st.payerDrop}
          onPress={() => {
            lightHaptic();
            if (payerBtnRef.current) {
              payerBtnRef.current.measureInWindow((x, y, w, h) => {
                const sw = Dimensions.get('window').width;
                setPayerDropPos({ top: y + h + 4, right: sw - x - w });
                setPayerDropOpen(true);
              });
            } else {
              setPayerDropOpen((o) => !o);
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={st.payerDropText}>{payer ? `Paid by ${payer.name}` : 'No payer'}</Text>
          {payerDropOpen
            ? <ChevronUpCircleIcon color={C.text} size={15} />
            : <ChevronDownCircleIcon color={C.text} size={15} />}
        </PressBtn>
      </View>

      <Dropdown visible={payerDropOpen} position={payerDropPos} onClose={() => setPayerDropOpen(false)} style={{ minWidth: 180 }}>
        <DropdownRow
          onPress={() => { lightHaptic(); setPaidBy(null); setPayerDropOpen(false); }}
          divider={false}
          trailing={!paidBy ? <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} /> : undefined}
        >
          <Text style={[st.payerDropItemText, !paidBy && { color: C.primary }]}>No payer</Text>
        </DropdownRow>
        {sortedPeople.map((person, i) => (
          <DropdownRow
            key={person.id}
            onPress={() => { lightHaptic(); setPaidBy(person.id); setPayerDropOpen(false); }}
            divider
            trailing={paidBy === person.id ? <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} /> : undefined}
          >
            <Text style={[st.payerDropItemText, paidBy === person.id && { color: C.primary }]}>{person.name}</Text>
          </DropdownRow>
        ))}
      </Dropdown>

      <ScrollView style={st.scroll} contentContainerStyle={st.content}>
        {splits.map((split, i) => {
          const paid = isPersonPaid(split.person.id);
          return (
            <PersonCard
              key={split.person.id}
              split={split}
              index={i}
              color={PERSON_COLORS[i % PERSON_COLORS.length]}
              payer={payer}
              paid={paid}
              isPayer={split.person.id === paidBy}
              onOpenDetail={() => setDetailPerson({ split, colorIdx: i })}
              onMarkPaid={() => { if (savedSplitId) setPersonPaid(savedSplitId, split.person.id, !paid, !paid ? split.total : 0); }}
              onShare={() => setSharePerson({ split, colorIdx: i })}
            />
          );
        })}
      </ScrollView>

      <View style={[st.footer, { flexDirection: 'row', gap: 10 }]}>
        <Button variant="secondary" size="big" label="Share" icon={<SendIcon color={C.text} size={18} />} onPress={() => setShareImageVisible(true)} style={{ flex: 1 }} />
        <Button variant="primary" size="big" label="Done" onPress={handleDone} style={{ flex: 1 }} />
      </View>

      {shareImageVisible && (
        <ShareImageModal
          splits={splits}
          total={total}
          restaurantName={restaurantName ?? undefined}
          date={receiptDate ?? undefined}
          joinCode={joinCode}
          onClose={() => setShareImageVisible(false)}
        />
      )}
      {sharePerson && (
        <ShareImageModal
          splits={[sharePerson.split]}
          total={sharePerson.split.total}
          restaurantName={restaurantName ?? undefined}
          date={receiptDate ?? undefined}
          colorOffset={sharePerson.colorIdx}
          joinCode={joinCode}
          onClose={() => setSharePerson(null)}
        />
      )}

      <PersonDetailModal
        split={detailPerson?.split ?? null}
        index={detailPerson?.colorIdx ?? 0}
        payer={payer}
        paid={detailPerson ? isPersonPaid(detailPerson.split.person.id) : false}
        isPayer={detailPerson?.split.person.id === paidBy}
        onClose={() => setDetailPerson(null)}
        onMarkPaid={() => {
          if (!detailPerson || !savedSplitId) return;
          const id = detailPerson.split.person.id;
          const wasPaid = isPersonPaid(id);
          setPersonPaid(savedSplitId, id, !wasPaid, !wasPaid ? detailPerson.split.total : 0);
        }}
        onShare={() => { if (detailPerson) { setSharePerson(detailPerson); setDetailPerson(null); } }}
      />

      <Portal>
        <Snackbar
          visible={snackVisible}
          onDismiss={() => setSnackVisible(false)}
          duration={2500}
          style={st.snackbar}
          action={{ label: 'OK', onPress: () => setSnackVisible(false), textColor: C.primary }}
        >
          Split saved to history
        </Snackbar>
      </Portal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  totalBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  totalLabel: { ...Type.fieldLabel, color: C.textSub },
  totalAmt: { ...Type.h2, color: C.text, lineHeight: 30 },
  payerDrop: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card },
  payerDropText: { ...Type.pillLabel, color: C.text },
  payerDropItemText: { ...Type.labelMedium, color: C.text },


  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 16 },

  feedCardClosed: { opacity: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedTitle: { ...Type.cardTitle, color: C.text },
  closedTitle: { color: C.textDim },
  feedDesc: { ...Type.cardDesc, color: C.textSub, marginTop: -2 },
  feedTotal: { ...Type.cardTitle, color: C.text },
  paidAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidAmountText: { ...Type.cardTitle, color: C.textSub, textDecorationLine: 'line-through' },

  divider: { backgroundColor: C.border, marginVertical: 8 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  lineName: { flex: 1, color: C.text, ...Type.cardDesc },
  lineSplitBadge: { backgroundColor: C.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, flexShrink: 0 },
  lineSplitText: { color: C.textSub, fontFamily: 'Poppins_500Medium', fontSize: 11 },
  lineAmt: { color: C.text, ...Type.pillLabel },
  lineModifiers: { color: C.textDim, ...Type.caption, marginLeft: 8, marginTop: -2, marginBottom: 2 },
  expandActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  taxTipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  taxTipLabel: { flex: 1, color: C.textDim, ...Type.cardDesc },


  footer: { padding: 16, paddingTop: 8, gap: 8 },
  snackbar: { backgroundColor: C.card, marginBottom: 8 },

  // Modal shell (also used by ShareImageModal)
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { flexShrink: 1, backgroundColor: C.bg, borderRadius: 20, padding: 24, width: '100%', gap: 12 },
  modalTitle: { ...Type.h2, color: C.text, lineHeight: 26 },
  modalPersonName: { ...Type.cardTitle, color: C.text },
  modalPersonSub: { ...Type.cardDesc, color: C.textSub, marginTop: 1 },
  modalTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  modalTotalLabel: { ...Type.cardTitle, color: C.text },
  modalTotalAmt: { fontFamily: 'Poppins_900Black', fontSize: 18, color: C.text },

  // Share image modal
  modeToggle: { flexDirection: 'row', gap: 8 },
  imgModalCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  codeRowLabel: { ...Type.fieldLabel, color: C.textDim },
  codeRowValue: { flex: 1, ...Type.cardTitle, color: C.text, letterSpacing: 1 },
  codeRowAction: { ...Type.pillLabel, color: C.primary },

  shareCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10 },
  shareCardTitle: { fontFamily: 'Poppins_900Black', fontSize: 20, color: '#1a1a1a', textAlign: 'center' },
  shareCardDate: { ...Type.cardDesc, color: C.textSub, marginTop: 2 },
  shareCardCode: { ...Type.fieldLabel, color: C.textSub, marginTop: 4, letterSpacing: 0.3 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sharePersonName: { flex: 1, ...Type.pillLabel, color: '#1a1a1a' },
  sharePersonTotal: { fontFamily: 'Poppins_900Black', fontSize: 18, color: '#1a1a1a' },
  shareItems: { gap: 2, marginTop: 4 },
  shareSep: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
});
