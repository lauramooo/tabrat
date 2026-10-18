import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Keyboard, Platform, StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { PressBtn } from '@/components/PressBtn';
import { CheckCircleIcon, PlusIcon } from '@/components/FigmaIcons';
import { Button, Card, Dropdown, DropdownRow } from '@/components/design';
import { C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { Type } from '@/constants/typography';
import { getCurrencySymbol, sanitizeNumberInput } from '@/utils/calculator';
import { mediumHaptic, selectionHaptic } from '@/utils/haptics';
import { applyTextShortcuts } from '@/utils/text';

// The one-line "name / amount / payer" row that logs an expense without leaving the page, plus the
// page's big bottom button — shared by the Dashboard and Expenses tabs of trips and homes. The
// button is the page's normal add action until the row is touched; from then on it's this row's
// "Save expense" (disabled until name, amount and payer are all set). The caller only decides how
// the expense is saved (trip vs home) and what the button normally does.
export function QuickAddBar({ people, myName, currency, onSave, addLabel, onAdd, footerStyle }: {
  people: string[];
  myName: string;
  currency: string;
  onSave: (expense: { name: string; amount: number; payer: string }) => void;
  /** The bottom button's normal label and action, when the quick-add row is empty. */
  addLabel: string;
  onAdd: () => void;
  footerStyle?: StyleProp<ViewStyle>;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [payer, setPayer] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [payerDropOpen, setPayerDropOpen] = useState(false);
  const [payerDropPos, setPayerDropPos] = useState<{ bottom: number; right: number } | null>(null);
  const payerBtnRef = useRef<View>(null);
  const rowRef = useRef<View>(null);

  // The row is docked at the bottom of the screen, so the keyboard would cover it while typing in
  // it. When one of its own fields is focused, lift it just above the keyboard (in step with the
  // keyboard's animation); drop back down when the keyboard hides.
  const lift = useRef(new Animated.Value(0)).current;
  // Refs, not state, and either order works: the keyboard's show event and the field's focus event
  // can arrive in either order on a device, so each one re-runs the same placement check.
  const typingHere = useRef(false);
  const keyboardTop = useRef<number | null>(null);
  const animate = (toValue: number, duration?: number) =>
    Animated.timing(lift, { toValue, duration: duration || 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  const placeAboveKeyboard = (duration?: number) => {
    const kbTop = keyboardTop.current;
    if (!typingHere.current) return;
    if (kbTop == null) { animate(0, duration); return; }
    // Measures the untransformed wrapper (row + button), so this is their resting spot even mid-lift,
    // and both clear the keyboard — the button is the row's Save while typing.
    rowRef.current?.measureInWindow((_x, y, _w, h) => {
      // Flush with the keyboard — the footer's own bottom padding is the breathing room.
      const overlap = y + h - kbTop;
      animate(overlap > 0 ? -overlap : 0, duration);
    });
  };
  const placeRef = useRef(placeAboveKeyboard);
  placeRef.current = placeAboveKeyboard;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      // iOS also sends a "show" with the keyboard parked below the screen while it's going away.
      keyboardTop.current = e.endCoordinates.screenY < Dimensions.get('screen').height ? e.endCoordinates.screenY : null;
      placeRef.current(e.duration);
    });
    const onHide = Keyboard.addListener(hideEvt, (e) => { keyboardTop.current = null; animate(0, e.duration); });
    return () => { onShow.remove(); onHide.remove(); };
  }, []);
  const onFieldFocus = () => { typingHere.current = true; placeRef.current(); };

  const amount = parseFloat(amountText) || 0;
  const canSave = name.trim().length > 0 && amount > 0 && !!payer;
  const started = name.trim().length > 0 || amountText.length > 0 || !!payer;

  const openPayerDropdown = () => {
    selectionHaptic();
    // The payer list is a modal, which closes the keyboard anyway — and with it this row drops back
    // down. So close the keyboard first and open the list once the row has settled, positioned
    // against where it actually ends up (and with no field left focused to re-summon the keyboard).
    if (keyboardTop.current != null) {
      Keyboard.dismiss();
      setTimeout(measureAndOpenPayer, 320);
      return;
    }
    measureAndOpenPayer();
  };

  const measureAndOpenPayer = () => {
    if (payerBtnRef.current) {
      payerBtnRef.current.measureInWindow((_x: number, y: number) => {
        const sh = Dimensions.get('window').height;
        setPayerDropPos({ bottom: sh - y + 4, right: 16 });
        setPayerDropOpen(true);
      });
    } else {
      setPayerDropOpen((o) => !o);
    }
  };

  const save = () => {
    if (!canSave || !payer) return;
    mediumHaptic();
    Keyboard.dismiss();
    onSave({ name: name.trim(), amount, payer });
    setName('');
    setAmountText('');
    setPayer(null);
  };

  return (
    <View ref={rowRef} collapsable={false}>
      {/* Solid background: lifted over the page while typing, the row + button must cover what's behind. */}
      <Animated.View style={[s.lifted, { transform: [{ translateY: lift }] }]}>
        <View style={s.row}>
          <Card padding={0} row={false} radius={10} style={[s.nameCard, nameFocused && s.fieldActive]}>
            <TextInput
              style={[s.nameInput, { outlineWidth: 0 } as any]}
              value={name}
              onChangeText={(v) => setName(applyTextShortcuts(v))}
              onFocus={() => { setNameFocused(true); onFieldFocus(); }}
              onBlur={() => { typingHere.current = false; setNameFocused(false); }}
              placeholder="Quick add"
              placeholderTextColor={C.textDim}
              returnKeyType="next"
            />
          </Card>
          <Card padding={0} row={false} radius={10} style={[s.amountCard, amountFocused && s.fieldActive]}>
            <View style={s.amountInner}>
              <Text style={s.moneyPrefix}>{getCurrencySymbol(currency)}</Text>
              <TextInput
                style={[s.amountInput, { outlineWidth: 0 } as any]}
                value={amountText}
                onChangeText={(v) => setAmountText(sanitizeNumberInput(v))}
                onFocus={() => { setAmountFocused(true); onFieldFocus(); }}
                onBlur={() => { typingHere.current = false; setAmountFocused(false); }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.textDim}
                returnKeyType="done"
                onSubmitEditing={save}
              />
            </View>
          </Card>
          <PressBtn ref={payerBtnRef} style={[s.payerBtn, payerDropOpen && s.fieldActive]} onPress={openPayerDropdown} noShadow>
            <Text style={[s.payerText, !payer && { color: C.textDim }]} numberOfLines={1}>
              {payer ? (payer === myName ? 'Me' : payer) : 'Payer'}
            </Text>
          </PressBtn>
          <Dropdown visible={payerDropOpen} position={payerDropPos} onClose={() => setPayerDropOpen(false)} style={{ minWidth: 150 }}>
            {people.map((p, i) => (
              <DropdownRow
                key={p}
                onPress={() => { selectionHaptic(); setPayer(p); setPayerDropOpen(false); }}
                divider={i > 0}
                trailing={payer === p ? <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} /> : undefined}
              >
                <Text style={s.dropItemText}>{p === myName ? `${p} (me)` : p}</Text>
              </DropdownRow>
            ))}
          </Dropdown>
        </View>
        <View style={footerStyle}>
          {started ? (
            <Button variant="primary" size="big" label="Save expense" icon={<CheckCircleIcon color={C.text} size={18} />}
              disabled={!canSave} onPress={save} />
          ) : (
            <Button variant="primary" size="big" label={addLabel} icon={<PlusIcon color={C.text} size={18} />} onPress={onAdd} />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  lifted: { backgroundColor: C.bg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.bg, borderRadius: 14,
    boxShadow: '0px 4px 12px rgba(0,0,0,0.12)', elevation: 6,
  },
  fieldActive: { borderColor: C.text },
  nameCard: { flex: 1, height: InputMetrics.height, justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  nameInput: { ...Type.labelMedium, color: C.text, paddingHorizontal: 12 },
  amountCard: { width: 66, height: InputMetrics.height, justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  amountInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 2 },
  amountInput: { flex: 1, minWidth: 0, ...Type.pillLabel, color: C.text, padding: 0 },
  moneyPrefix: { ...Type.bodySmall, color: C.textSub },
  payerBtn: {
    width: 92, height: InputMetrics.height, alignItems: 'center', justifyContent: 'center',
    borderRadius: InputMetrics.radius, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
  },
  payerText: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: C.text },
  dropItemText: { ...Type.labelMedium, color: C.text },
});
