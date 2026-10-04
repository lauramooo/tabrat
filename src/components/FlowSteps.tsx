import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { createElement, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Image, Modal, Platform, Pressable, Share, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, CircleIconButton, ConfirmModal, EditableTitle } from '@/components/design';
import { ShareCodeModal } from '@/components/ShareCodeModal';
import {
  CalendarIcon, CheckCircleIcon, FriendsIcon, ItemsIcon, MoreIcon, PencilIcon, ReceiptIcon, ScissorIcon, SendIcon, TagIcon, TrashIcon,
} from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { fmtDate } from '@/utils/date';
import { selectionHaptic, lightHaptic } from '@/utils/haptics';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

function toInputDate(str: string): string {
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromInputDate(val: string): string {
  const formatted = fmtDate(val + 'T00:00:00');
  return formatted || val;
}

// -- Shared header title: name + date badge underneath, used on every screen that has a back
// button on the left and a header action button on the right (bills, trips, homes). Always
// renders the date slot (invisible when no date) so header height stays identical across screens
// and any row rendered below it never shifts. Rendered as its own full-width row BELOW the native
// header bar (not as that bar's headerTitle) — putting it in the same row as the back/more buttons
// meant native-stack's headerTitleAlign:'center' only centered it within whatever space was left
// after those fixed-width buttons, so a long name still ran behind the right-hand one instead of
// just truncating in the middle of open space. On its own row it gets the full screen width. ----

export function ScreenHeaderTitle({ name, date, endDate, reserveDateSlot = true, children }: {
  name: string; date?: string; endDate?: string; reserveDateSlot?: boolean; children?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const maxTitleWidth = Math.max(140, width - 40);
  const startText = date ? (fmtDate(date) || date) : '00/00/0000';
  const endText = endDate ? (fmtDate(endDate) || endDate) : '';
  return (
    <View style={{ alignItems: 'center', maxWidth: maxTitleWidth }}>
      <Text style={styles.bhTitle} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
      {(date || reserveDateSlot) && (
        <View style={[styles.bhDateHighlight, !date && { opacity: 0 }]}>
          <Text style={styles.bhDate}>{startText}{endText ? ` – ${endText}` : ''}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

// Old name kept as an alias — this component isn't specific to bills anymore, but existing
// callers (BillHeader below, trip/new.tsx) don't need to change just to pick up the width fix.
export const BillHeaderTitle = ScreenHeaderTitle;

// Wraps ScreenHeaderTitle's full-width row below the native header — shared (not copy-pasted
// per screen) so bills, trips, and homes are guaranteed the exact same vertical spacing between
// the header buttons and the title. A per-screen copy of just the style object previously drifted
// enough for the trip/home header to visibly sit lower than the bill header despite looking
// identical in the source.
export function ScreenSubHeader({ children }: { children: React.ReactNode }) {
  return <View style={styles.subHeaderRow}>{children}</View>;
}

// -- Shared bill header (Stack.Screen + modals) -------------------------------

let DateTimePickerBH: any = null;
if (Platform.OS !== 'web') {
  DateTimePickerBH = require('@react-native-community/datetimepicker').default;
}

export function BillHeader() {
  const { restaurantName, receiptDate, imageUri, setRestaurantName, setReceiptDate, savedSplitId, history, deleteHistory, closeTab, reset } = useSplitStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The actions menu renders in a full-screen Modal, which ignores the header's own layout
  // entirely — position it using the safe-area inset plus the standard native header content
  // height so it lands just under the header button regardless of notch/status-bar size, instead
  // of a fixed pixel guess that only worked on the one device it was eyeballed against.
  const headerContentHeight = Platform.OS === 'ios' ? 44 : 56;
  const actionsTop = insets.top + headerContentHeight + 6;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [titleKey, setTitleKey] = useState(0);
  const [editDate, setEditDate] = useState('');
  const [actionsModal, setActionsModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareCodeVisible, setShareCodeVisible] = useState(false);

  const joinCode = savedSplitId ? history.find((r) => r.id === savedSplitId)?.joinCode : undefined;

  const parsedDate = (() => { const d = new Date(editDate || receiptDate); return isNaN(d.getTime()) ? new Date() : d; })();

  const openEdit = () => { setEditName(restaurantName || ''); setEditDate(receiptDate || ''); setTitleKey((k) => k + 1); setEditModal(true); };
  const commitName = (v: string) => { setEditName(v); setRestaurantName(v); };
  const commitDate = (v: string) => { setEditDate(v); setReceiptDate(v); };

  const handleShare = async () => {
    // Once the bill's been saved it has a join code — sharing it (rather than a plain text
    // blurb) is the meaningful "share this bill" action from that point on.
    if (joinCode) { setShareCodeVisible(true); return; }
    try {
      await Share.share({ message: `${restaurantName || 'Bill'}${receiptDate ? ` — ${receiptDate}` : ''}` });
    } catch {}
  };

  const handleDelete = () => {
    if (savedSplitId) deleteHistory(savedSplitId);
    reset();
    setConfirmDelete(false);
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{
        headerBackTitle: '',
        headerTitleAlign: 'center',
        headerTransparent: false,
        headerStyle: { backgroundColor: C.bg },
        // Some screens that render <BillHeader/> (e.g. people.tsx) also set their own static
        // `title` at the navigator level (_layout.tsx) — headerTitle:()=>null alone doesn't
        // suppress that string, so both it and this screen's own title row below were showing
        // stacked on top of each other. Clearing `title` too removes the leftover native one.
        title: '',
        headerTitle: () => null,
        headerRight: () => (
          <PressBtn onPress={() => setActionsModal(true)} activeOpacity={0.5} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <MoreIcon color={C.text} size={20} />
          </PressBtn>
        ),
      }} />
      <ScreenSubHeader>
        <ScreenHeaderTitle name={restaurantName || 'New bill'} date={receiptDate} />
      </ScreenSubHeader>

      {/* Actions menu — Apple-style dropdown from header button */}
      <Modal visible={actionsModal} transparent animationType="fade" onRequestClose={() => setActionsModal(false)}>
        <Pressable style={styles.actionsBackdrop} onPress={() => setActionsModal(false)}>
          <View style={[styles.actionsCard, { top: actionsTop }]}>
            <PressBtn style={styles.actionsRow} onPress={() => { setActionsModal(false); openEdit(); }} activeOpacity={0.6}>
              <PencilIcon color={C.textSub} size={17} />
              <Text style={styles.actionsRowText}>Edit</Text>
            </PressBtn>
            <PressBtn style={[styles.actionsRow, styles.actionsRowDivider]} onPress={() => { setActionsModal(false); handleShare(); }} activeOpacity={0.6}>
              <SendIcon color={C.textSub} size={17} />
              <Text style={styles.actionsRowText}>Share</Text>
            </PressBtn>
            {!!savedSplitId && (
              <PressBtn style={[styles.actionsRow, styles.actionsRowDivider]} onPress={() => { setActionsModal(false); closeTab(savedSplitId); reset(); router.replace('/'); }} activeOpacity={0.6}>
                <CheckCircleIcon color={C.textSub} size={17} />
                <Text style={styles.actionsRowText}>Close bill</Text>
              </PressBtn>
            )}
            <PressBtn style={[styles.actionsRow, styles.actionsRowDivider]} onPress={() => { setActionsModal(false); setConfirmDelete(true); }} activeOpacity={0.6}>
              <TrashIcon color={C.error} size={17} />
              <Text style={[styles.actionsRowText, { color: C.error }]}>Delete</Text>
            </PressBtn>
          </View>
        </Pressable>
      </Modal>

      <ShareCodeModal
        visible={shareCodeVisible}
        onClose={() => setShareCodeVisible(false)}
        title="Share bill"
        code={joinCode}
        message={`Join my bill split on Tab Rat! Code: ${joinCode}`}
      />

      {/* Edit bill modal */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <Pressable style={styles.bhBackdrop} onPress={() => setEditModal(false)}>
          <Pressable style={styles.bhCard} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <EditableTitle key={titleKey} value={editName} onChangeText={setEditName} placeholder="Bill title" fallback="Bill" />
              <CircleIconButton variant="close" size={20} color={C.text} onPress={() => setEditModal(false)} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.bhFieldLabel}>DATE</Text>
              {Platform.OS === 'web' ? (
                <View style={[styles.bhDateRow, { position: 'relative' }]}>
                  <CalendarIcon size={15} color={C.text} />
                  <Text style={[styles.bhDateRowText, !(editDate || receiptDate) && { color: C.textDim }]}>
                    {fmtDate(editDate || receiptDate) || editDate || receiptDate || 'Set date'}
                  </Text>
                  {createElement('input', {
                    type: 'date',
                    value: toInputDate(editDate || receiptDate),
                    onChange: (e: any) => setEditDate(fromInputDate(e.target.value)),
                    style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any,
                  })}
                </View>
              ) : (
                <>
                  <PressBtn style={styles.bhDateRow} onPress={() => setShowDatePicker((s) => !s)} activeOpacity={0.7}>
                    <CalendarIcon size={15} color={C.text} />
                    <Text style={[styles.bhDateRowText, !(editDate || receiptDate) && { color: C.textDim }]}>
                      {fmtDate(editDate || receiptDate) || editDate || receiptDate || 'Set date'}
                    </Text>
                  </PressBtn>
                  {showDatePicker && DateTimePickerBH && (
                    <>
                      <DateTimePickerBH
                        value={parsedDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={(event: any, selected?: Date) => {
                          if (Platform.OS === 'android') setShowDatePicker(false);
                          if (selected && event.type !== 'dismissed') setEditDate(fmtDate(selected));
                        }}
                        themeVariant="light"
                      />
                      {Platform.OS === 'ios' && (
                        <PressBtn onPress={() => setShowDatePicker(false)} style={{ paddingVertical: 8, alignItems: 'flex-end' }}>
                          <Text style={{ ...Type.button, color: C.primary }}>Done</Text>
                        </PressBtn>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="small" label="Cancel" onPress={() => setEditModal(false)} />
              <Button variant="primary" size="small" label="Save" onPress={() => { setRestaurantName(editName); if (editDate) setReceiptDate(editDate); setEditModal(false); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Remove bill?"
        body="This will remove the tab from your history."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
      />

      {/* Receipt preview */}
      <Modal visible={showReceiptModal} transparent animationType="fade" onRequestClose={() => setShowReceiptModal(false)}>
        <Pressable style={styles.receiptOverlay} onPress={() => setShowReceiptModal(false)}>
          <Pressable style={styles.receiptSheet} onPress={() => {}}>
            <CircleIconButton variant="close" size={22} color="#fff" onPress={() => setShowReceiptModal(false)} style={styles.receiptClose} />
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.receiptImage} resizeMode="contain" />
            ) : (
              <View style={styles.receiptEmpty}>
                <MaterialCommunityIcons name="image-off-outline" size={48} color={C.textDim} />
                <Text style={{ color: C.textSub, marginTop: 8 }}>No receipt image</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function ReceiptHeader({ editableName }: { editableName?: boolean } = {}) {
  const { restaurantName, receiptDate, setReceiptDate, setRestaurantName, imageUri } = useSplitStore();
  const [showPicker, setShowPicker] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const parsedDate = (() => { const d = new Date(receiptDate); return isNaN(d.getTime()) ? new Date() : d; })();

  if (!editableName && !restaurantName && !receiptDate) return null;

  return (
    <View style={styles.headerRow}>
      {editableName ? (
        <PressBtn onLongPress={() => setEditingTitle(true)} delayLongPress={350} activeOpacity={0.85} style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <TextInput
              autoFocus
              style={styles.headerTitleInput}
              value={restaurantName}
              onChangeText={setRestaurantName}
              onBlur={() => setEditingTitle(false)}
              onSubmitEditing={() => setEditingTitle(false)}
              placeholder="Bill title"
              placeholderTextColor={C.textDim}
            />
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>{restaurantName || 'Bill title'}</Text>
          )}
        </PressBtn>
      ) : (
        <Text style={styles.headerTitle} numberOfLines={1}>{restaurantName || 'Receipt'}</Text>
      )}

      {/* Receipt preview button */}
      <PressBtn onPress={() => setShowReceipt(true)} activeOpacity={0.7} noShadow style={styles.receiptBtn}>
        <ReceiptIcon size={20} color={C.text} />
      </PressBtn>

      {/* Receipt image modal */}
      <Modal visible={showReceipt} transparent animationType="fade" onRequestClose={() => setShowReceipt(false)}>
        <Pressable style={styles.receiptOverlay} onPress={() => setShowReceipt(false)}>
          <Pressable style={styles.receiptSheet} onPress={() => {}}>
            <CircleIconButton variant="close" size={22} color="#fff" onPress={() => setShowReceipt(false)} style={styles.receiptClose} />
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.receiptImage} resizeMode="contain" />
            ) : (
              <View style={styles.receiptEmpty}>
                <MaterialCommunityIcons name="image-off-outline" size={48} color={C.textDim} />
                <Text style={{ color: C.textSub, marginTop: 8 }}>No receipt image</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date pill — web: native date input styled as pill; browser handles picker natively */}
      {Platform.OS === 'web' ? (
        <View style={[styles.headerDatePill, { position: 'relative' }]}>
          <CalendarIcon size={15} color={C.text} />
          <Text style={[styles.headerDateText, !receiptDate && { color: C.textDim }]}>{(receiptDate && (fmtDate(receiptDate) || receiptDate)) || 'Set date'}</Text>
          {createElement('input', {
            type: 'date',
            value: toInputDate(receiptDate),
            onChange: (e: any) => { const v = e.target.value; if (v) setReceiptDate(fromInputDate(v)); },
            style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', border: 'none', outline: 'none' } as any,
          })}
        </View>
      ) : (
        <>
          <PressBtn style={styles.headerDatePill} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
            <CalendarIcon size={15} color={C.text} />
            <Text style={[styles.headerDateText, !receiptDate && { color: C.textDim }]}>{(receiptDate && (fmtDate(receiptDate) || receiptDate)) || 'Set date'}</Text>
          </PressBtn>
          {DateTimePicker && (
            <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
              <Pressable style={styles.pickerBackdrop} onPress={() => setShowPicker(false)}>
                <Pressable style={styles.pickerSheet} onPress={() => {}}>
                  <DateTimePicker
                    value={parsedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(event: any, selected?: Date) => {
                      if (Platform.OS === 'android') setShowPicker(false);
                      if (selected && event.type !== 'dismissed') setReceiptDate(fmtDate(selected));
                    }}
                    style={{ backgroundColor: C.card }}
                    themeVariant="light"
                  />
                  {Platform.OS === 'ios' && (
                    <PressBtn style={styles.pickerDone} onPress={() => setShowPicker(false)}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </PressBtn>
                  )}
                </Pressable>
              </Pressable>
            </Modal>
          )}
        </>
      )}
    </View>
  );
}

const STEPS = [
  { label: 'Items',   Icon: ItemsIcon,   route: '/review'   },
  { label: 'Friends', Icon: FriendsIcon, route: '/people'   },
  { label: 'Assign',  Icon: TagIcon,     route: '/assign'   },
  { label: 'Split',   Icon: ScissorIcon, route: '/summary'  },
] as const;

export function FlowSteps({ active }: { active: number }) {
  const router = useRouter();

  return (
    <View style={styles.flowRow}>
      <View style={styles.bar}>
        <PressBtn
          style={styles.pill}
          onPress={() => { if (active !== -1) { selectionHaptic(); router.replace('/upload'); } }}
          activeOpacity={0.7}
        >
          <ReceiptIcon color={active === -1 ? C.primary : C.textSub} size={22} />
          {active === -1 && <View style={styles.pillIndicator} />}
        </PressBtn>
        {STEPS.map(({ label, Icon, route }, i) => {
          const isActive = i === active;
          const isDone   = i < active;
          const iconColor = isActive ? C.primary : isDone ? C.textSub : C.textDim;
          return (
            <PressBtn
              key={label}
              style={styles.pill}
              onPress={() => { if (!isActive) { selectionHaptic(); router.replace(route); } }}
              activeOpacity={0.7}
            >
              <Icon color={iconColor} size={22} />
              {isActive && <View style={styles.pillIndicator} />}
            </PressBtn>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-width row rendered below the native header bar (which shows only the back/more buttons)
  // so the title never has to share horizontal space with them — see ScreenHeaderTitle above.
  subHeaderRow: { backgroundColor: C.bg, alignItems: 'center', paddingBottom: 8 },
  // BillHeader
  bhTitle: { ...Type.h2, color: C.text, letterSpacing: 0.3 },
  bhDateHighlight: { marginTop: -4 },
  bhDate: { ...Type.cardDesc, color: C.textSub },
  bhBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.primaryDim, justifyContent: 'center', alignItems: 'center' },
  bhBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  bhCard: { backgroundColor: C.bg, borderRadius: 20, padding: 20, width: '100%', gap: 12 },
  bhFieldLabel: { ...Type.fieldLabel, color: C.textSub },
  actionsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  actionsCard: {
    position: 'absolute', right: 10,
    backgroundColor: C.bg, borderRadius: 14, width: 210,
    overflow: 'hidden',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  actionsRowText: { ...Type.bodySmall, color: C.text },
  actionsRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  bhDateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  bhDateRowText: { flex: 1, ...Type.labelMedium, color: C.text },

  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  bar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 999,
    padding: 4,
  },
  pill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pillIndicator: { width: 14, height: 2, borderRadius: 999, backgroundColor: C.text, marginTop: 3 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6,
  },
  receiptBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.primaryDim, justifyContent: 'center', alignItems: 'center' },
  receiptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  receiptSheet: { backgroundColor: '#111', borderRadius: 16, padding: 12, width: '100%', maxWidth: 480 },
  receiptClose: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
  receiptImage: { width: '100%', height: 480, borderRadius: 8 },
  receiptEmpty: { height: 200, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: C.text, ...Type.h1, letterSpacing: 0.5 },
  headerTitleInput: { color: C.text, ...Type.h1, letterSpacing: 0.5, padding: 0, borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 2 },
  headerDatePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: C.primaryDim,
  },
  headerDateText: { color: C.text, fontSize: 12, fontFamily: 'Poppins_500Medium' },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  pickerSheet: { backgroundColor: C.bg, borderRadius: 20, paddingBottom: 16, paddingHorizontal: 16, paddingTop: 12, width: '100%' },
  pickerDone: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  pickerDoneText: { color: C.primary, fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
});
