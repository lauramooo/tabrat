import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { CloseCircleIcon, FriendsIcon, MinusCircleIcon, PencilIcon, PlusCircleIcon, PlusIcon, ReorderIcon, TrashIcon } from '@/components/FigmaIcons';
import { useRouter } from 'expo-router';
import { ScaleDecorator, NestableDraggableFlatList, NestableScrollContainer } from 'react-native-draggable-flatlist';
import { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, CenteredModal, FieldLabel, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { InputMetrics } from '@/constants/spacing';
import { BillHeader, FlowSteps } from '@/components/FlowSteps';
import { useSplitStore } from '@/store/useSplitStore';
import { fmt, sanitizeNumberInput } from '@/utils/calculator';
import { lightHaptic, mediumHaptic } from '@/utils/haptics';
import type { ExtraCharge } from '@/types';

type ItemData = { id: string; name: string; price: number; quantity: number; modifiers?: string[] };

// -- Item row ------------------------------------------------------------------

function ActionPill({
  progress, icon, iconNode, label, color, textColor = C.text, onPress,
}: {
  progress: Animated.AnimatedInterpolation<number>;
  icon?: string; iconNode?: (color: string) => React.ReactNode; label: string; color: string; textColor?: string; onPress: () => void;
}) {
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [36, 74], extrapolate: 'clamp' });
  const textOp = progress.interpolate({ inputRange: [0.5, 0.9], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <PressBtn style={s.actionWrap} onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[s.actionPill, { width, backgroundColor: color }]}>
        {iconNode ? iconNode(textColor) : <MaterialCommunityIcons name={icon as any} size={15} color={textColor} />}
        <Animated.Text style={[s.actionLabel, { opacity: textOp, color: textColor }]}>{label}</Animated.Text>
      </Animated.View>
    </PressBtn>
  );
}

function ItemRow({ item, onEdit, drag, isActive }: {
  item: ItemData; onEdit: (i: ItemData) => void; drag: () => void; isActive: boolean;
}) {
  const { removeItem } = useSplitStore();
  const swipeRef = useRef<Swipeable>(null);
  return (
    <ScaleDecorator activeScale={1}>
      <Swipeable
        ref={swipeRef}
        overshootRight={false}
        enabled={!isActive}
        // Swipeable only constrains itself to horizontal movement (activeOffsetX) — without also
        // telling it to fail fast on vertical movement, it can hang onto the touch briefly on iOS
        // before handing off to the parent scroll view, which is exactly what blocked scrolling
        // when a drag started on top of a row.
        failOffsetY={[-10, 10]}
        renderRightActions={(progress) => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActionPill
              progress={progress} iconNode={(c) => <PencilIcon color={c} size={15} />} label="Edit" color={C.pillInfo}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); onEdit(item); }}
            />
            <ActionPill
              progress={progress} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
              onPress={() => { lightHaptic(); swipeRef.current?.close(); removeItem(item.id); }}
            />
          </View>
        )}
      >
        <View style={[s.itemRow, isActive && s.itemRowDragging]}>
          <PressBtn onLongPress={drag} delayLongPress={150} hitSlop={8} activeOpacity={0.4} noShadow>
            <ReorderIcon color={C.textDim} size={14} />
          </PressBtn>
          <PressBtn
            style={{ flex: 1 }}
            onPress={() => { lightHaptic(); onEdit(item); }}
            activeOpacity={0.6}
            noShadow
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.itemQty}>×{item.quantity}</Text>
              <Text style={s.itemPrice}>{fmt(item.price)}</Text>
            </View>
            {!!item.modifiers?.length && (
              <Text style={s.itemModifiers} numberOfLines={2}>{item.modifiers.join(', ')}</Text>
            )}
          </PressBtn>
        </View>
      </Swipeable>
    </ScaleDecorator>
  );
}

// -- Extra charge / discount section (styled like the Tax/Tip sections below) --

function ExtraChargeRow({ charge, subtotal, focusedInput, setFocusedInput }: {
  charge: ExtraCharge; subtotal: number;
  focusedInput: string | null; setFocusedInput: (v: string | null) => void;
}) {
  const { updateExtraCharge, removeExtraCharge } = useSplitStore();
  const [localName, setLocalName] = useState(charge.name);
  const [pct, setPct] = useState(() => subtotal > 0 && charge.amount > 0 ? ((charge.amount / subtotal) * 100).toFixed(2) : '');
  const [dollar, setDollar] = useState(charge.amount > 0 ? charge.amount.toFixed(2) : '');

  const nameFor = (n: string) => n || (charge.isDiscount ? 'Discount' : 'Charge');
  const commitName = () => updateExtraCharge(charge.id, nameFor(localName), parseFloat(dollar) || 0);
  const onPctChange = (raw: string) => {
    const v = sanitizeNumberInput(raw);
    setPct(v);
    const d = subtotal * (parseFloat(v) || 0) / 100;
    const dStr = d > 0 ? d.toFixed(2) : '';
    setDollar(dStr);
    updateExtraCharge(charge.id, nameFor(localName), parseFloat(dStr) || 0);
  };
  const onDollarChange = (raw: string) => {
    const v = sanitizeNumberInput(raw);
    setDollar(v);
    const p = subtotal > 0 ? (parseFloat(v) || 0) / subtotal * 100 : 0;
    setPct(p > 0 ? p.toFixed(2) : '');
    updateExtraCharge(charge.id, nameFor(localName), parseFloat(v) || 0);
  };
  const pctKey = `charge-${charge.id}-pct`;
  const dollarKey = `charge-${charge.id}-dollar`;

  return (
    <View>
      <View style={s.chargeHeaderRow}>
        <TextInput
          style={[s.chargeNameInput, { outlineWidth: 0 } as any]}
          value={localName}
          onChangeText={setLocalName}
          onBlur={commitName}
          placeholder={charge.isDiscount ? 'Discount' : 'Charge'}
          placeholderTextColor={C.textDim}
          autoComplete="off"
        />
        <PressBtn onPress={() => { lightHaptic(); removeExtraCharge(charge.id); }} hitSlop={8}>
          <CloseCircleIcon size={16} color={C.textDim} />
        </PressBtn>
      </View>
      <View style={s.ttRow}>
        <View style={s.ttCol1}>
          <View style={[s.ttBox, focusedInput === pctKey && s.ttBoxFocused]}>
            <Text style={s.ttPrefix}>%</Text>
            <TextInput style={[s.ttInput, { outlineWidth: 0 } as any]} value={pct} onChangeText={onPctChange} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.textDim} onFocus={() => setFocusedInput(pctKey)} onBlur={() => setFocusedInput(null)} />
          </View>
        </View>
        <View style={s.ttCol2}>
          <View style={[s.ttBox, focusedInput === dollarKey && s.ttBoxFocused]}>
            <Text style={s.ttPrefix}>{charge.isDiscount ? '-$' : '$'}</Text>
            <TextInput style={[s.ttInput, { outlineWidth: 0 } as any]} value={dollar} onChangeText={onDollarChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim} onFocus={() => setFocusedInput(dollarKey)} onBlur={() => setFocusedInput(null)} />
          </View>
        </View>
      </View>
    </View>
  );
}

// -- Inline add row ------------------------------------------------------------

function InlineAddRow({ onAdd }: { onAdd: (name: string, price: number, qty: number) => void }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [focused, setFocused] = useState(false);
  const canAdd = name.trim().length > 0 && parseFloat(price) > 0;

  const submit = () => {
    if (!canAdd) return;
    lightHaptic();
    onAdd(name.trim(), parseFloat(price) * (parseInt(qty) || 1), parseInt(qty) || 1);
    setName(''); setQty('1'); setPrice('');
  };

  return (
    <View style={[s.addRow, focused && s.addRowFocused]}>
      <TextInput
        style={[s.addNameInput, { outlineWidth: 0 } as any]}
        placeholder="Item name"
        placeholderTextColor={C.textDim}
        value={name}
        onChangeText={setName}
        returnKeyType="next"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
      <Text style={s.addSep}>·</Text>
      <TextInput
        style={[s.addQtyInput, { outlineWidth: 0 } as any]}
        value={qty}
        onChangeText={(v) => setQty(sanitizeNumberInput(v))}
        keyboardType="number-pad"
        selectTextOnFocus
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
      <Text style={s.addSep}>$</Text>
      <TextInput
        style={[s.addPriceInput, { outlineWidth: 0 } as any]}
        value={price}
        onChangeText={(v) => setPrice(sanitizeNumberInput(v))}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={C.textDim}
        onSubmitEditing={submit}
        returnKeyType="done"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      />
      <PressBtn
        style={[s.addPlusBtn, canAdd && s.addPlusBtnActive]}
        onPress={submit}
        disabled={!canAdd}
        activeOpacity={0.7}
      >
        <PlusIcon color={canAdd ? '#fff' : C.textDim} size={18} />
      </PressBtn>
    </View>
  );
}

// -- Item modal ----------------------------------------------------------------

function ItemModal({ visible, editItem, onClose }: { visible: boolean; editItem: ItemData | null; onClose: () => void }) {
  const { addItemWithDetails, updateItem } = useSplitStore();
  const isEdit = !!editItem;
  const [name, setName] = useState(editItem?.name ?? '');
  const [qty, setQty] = useState(editItem ? String(editItem.quantity || 1) : '1');
  const [unitPrice, setUnitPrice] = useState(
    editItem ? (editItem.quantity > 0 ? editItem.price / editItem.quantity : editItem.price).toFixed(2) : '',
  );
  const [focused, setFocused] = useState<string | null>(null);

  const prevKey = useRef<string | null>(null);
  const key = visible ? (editItem ? editItem.id : 'new') : null;
  if (visible && prevKey.current !== key) {
    prevKey.current = key;
    if (editItem) {
      setName(editItem.name);
      setQty(String(editItem.quantity || 1));
      setUnitPrice((editItem.quantity > 0 ? editItem.price / editItem.quantity : editItem.price).toFixed(2));
    } else { setName(''); setQty('1'); setUnitPrice(''); }
  } else if (!visible && prevKey.current !== null) {
    prevKey.current = null;
  }

  const parsedQty = Math.max(1, parseInt(qty) || 1);
  const parsedUnit = parseFloat(unitPrice) || 0;
  const total = parsedQty * parsedUnit;

  const submit = () => {
    if (!name.trim() || parsedUnit <= 0) return;
    lightHaptic();
    if (isEdit && editItem) updateItem(editItem.id, name.trim(), total, parsedQty);
    else addItemWithDetails(name.trim(), total, parsedQty);
    onClose();
  };

  return (
    <CenteredModal visible={visible} onClose={onClose} maxWidth={400} radius={20} padding={24} title={<Text style={s.modalTitle}>{isEdit ? 'Edit item' : 'Add item'}</Text>}>
          <Input
            style={[s.modalInput, { outlineWidth: 0 } as any]}
            placeholder="Item name" placeholderTextColor={C.textDim} value={name} onChangeText={setName}
            autoFocus={!isEdit}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalLabel}>Qty</Text>
              <Input
                style={[s.modalInput, { outlineWidth: 0 } as any]}
                value={qty} onChangeText={(v) => setQty(sanitizeNumberInput(v))} keyboardType="number-pad" placeholder="1" placeholderTextColor={C.textDim}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={s.modalLabel}>Unit price</Text>
              <View style={[s.modalPriceBox, focused === 'price' && s.modalInputFocused]}>
                <Text style={s.modalPriceDollar}>$</Text>
                <TextInput
                  style={[s.modalPriceInput, { outlineWidth: 0 } as any]}
                  value={unitPrice} onChangeText={(v) => setUnitPrice(sanitizeNumberInput(v))} keyboardType="decimal-pad"
                  placeholder="0.00" placeholderTextColor={C.textDim}
                  onFocus={() => setFocused('price')} onBlur={() => setFocused(null)}
                />
              </View>
            </View>
          </View>
          {parsedQty > 1 && parsedUnit > 0 && <Text style={s.modalSubtotal}>Total: {fmt(total)}</Text>}
          <View style={s.modalBtns}>
            <Button
              variant="primary"
              size="small"
              label={isEdit ? 'Save' : 'Add'}
              onPress={submit}
              disabled={!name.trim() || parsedUnit <= 0}
              style={{ flex: 1 }}
            />
          </View>
    </CenteredModal>
  );
}

// -- Charge modal ----------------------------------------------------------------

function ChargeModal({ visible, initialIsDiscount = false, subtotal, onClose }: { visible: boolean; initialIsDiscount?: boolean; subtotal: number; onClose: () => void }) {
  const { addExtraChargeWithDetails } = useSplitStore();
  const [name, setName] = useState('');
  const [pct, setPct] = useState('');
  const [amount, setAmount] = useState('');
  const [focused, setFocused] = useState<'pct' | 'amount' | null>(null);

  const prevVisible = useRef(false);
  if (visible && !prevVisible.current) {
    prevVisible.current = true;
  } else if (!visible && prevVisible.current) {
    prevVisible.current = false;
    setName(''); setPct(''); setAmount('');
  }

  const isDiscount = initialIsDiscount;
  const parsedAmount = parseFloat(amount) || 0;

  const onPctChange = (raw: string) => {
    const v = sanitizeNumberInput(raw);
    setPct(v);
    const d = subtotal * (parseFloat(v) || 0) / 100;
    setAmount(d > 0 ? d.toFixed(2) : '');
  };
  const onAmountChange = (raw: string) => {
    const v = sanitizeNumberInput(raw);
    setAmount(v);
    const p = subtotal > 0 ? (parseFloat(v) || 0) / subtotal * 100 : 0;
    setPct(p > 0 ? p.toFixed(2) : '');
  };

  const submit = () => {
    if (parsedAmount <= 0) return;
    lightHaptic();
    addExtraChargeWithDetails(name.trim() || (isDiscount ? 'Discount' : 'Charge'), parsedAmount, isDiscount || undefined);
    onClose();
  };

  return (
    <CenteredModal visible={visible} onClose={onClose} maxWidth={400} radius={20} padding={24} title={<Text style={s.modalTitle}>{isDiscount ? 'Add discount' : 'Add charge'}</Text>}>
      <Input
        style={[s.modalInput, { outlineWidth: 0 } as any]}
        placeholder={isDiscount ? 'Discount' : 'Charge'} placeholderTextColor={C.textDim} value={name} onChangeText={setName}
        autoFocus
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.modalLabel}>Percent</Text>
          <View style={[s.modalPriceBox, focused === 'pct' && s.modalInputFocused]}>
            <Text style={s.modalPriceDollar}>%</Text>
            <TextInput
              style={[s.modalPriceInput, { outlineWidth: 0 } as any]}
              value={pct} onChangeText={onPctChange} keyboardType="decimal-pad"
              placeholder="0" placeholderTextColor={C.textDim}
              onFocus={() => setFocused('pct')} onBlur={() => setFocused(null)}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.modalLabel}>Amount</Text>
          <View style={[s.modalPriceBox, focused === 'amount' && s.modalInputFocused]}>
            <Text style={s.modalPriceDollar}>{isDiscount ? '-$' : '$'}</Text>
            <TextInput
              style={[s.modalPriceInput, { outlineWidth: 0 } as any]}
              value={amount} onChangeText={onAmountChange} keyboardType="decimal-pad"
              placeholder="0.00" placeholderTextColor={C.textDim}
              onFocus={() => setFocused('amount')} onBlur={() => setFocused(null)}
            />
          </View>
        </View>
      </View>
      <View style={s.modalBtns}>
        <Button variant="primary" size="small" label="Add" onPress={submit} disabled={parsedAmount <= 0} style={{ flex: 1 }} />
      </View>
    </CenteredModal>
  );
}

// -- Main screen ---------------------------------------------------------------

export default function ReviewScreen() {
  const router = useRouter();
  const {
    items, tax, tip, extraCharges,
    setTax, setTip, addItemWithDetails, setItemOrder,
  } = useSplitStore();

  // Tax / Tip
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const [taxPct, setTaxPct] = useState(() => subtotal > 0 && tax > 0 ? ((tax / subtotal) * 100).toFixed(2) : '');
  const [taxDollar, setTaxDollar] = useState(tax > 0 ? tax.toFixed(2) : '');
  const [tipPct, setTipPct] = useState(() => subtotal > 0 && tip > 0 ? ((tip / subtotal) * 100).toFixed(0) : '');
  const [tipDollar, setTipDollar] = useState(tip > 0 ? tip.toFixed(2) : '');

  const onTaxPctChange = (raw: string) => { const v = sanitizeNumberInput(raw); setTaxPct(v); const d = subtotal * (parseFloat(v) || 0) / 100; setTaxDollar(d > 0 ? d.toFixed(2) : ''); };
  const onTaxDollarChange = (raw: string) => { const v = sanitizeNumberInput(raw); setTaxDollar(v); const p = subtotal > 0 ? (parseFloat(v) || 0) / subtotal * 100 : 0; setTaxPct(p > 0 ? p.toFixed(2) : ''); };
  const onTipPctChange = (raw: string) => { const v = sanitizeNumberInput(raw); setTipPct(v); const d = subtotal * (parseFloat(v) || 0) / 100; setTipDollar(d > 0 ? d.toFixed(2) : ''); };
  const onTipDollarChange = (raw: string) => { const v = sanitizeNumberInput(raw); setTipDollar(v); const p = subtotal > 0 ? (parseFloat(v) || 0) / subtotal * 100 : 0; setTipPct(p > 0 ? p.toFixed(0) : ''); };
  const parsedTax = parseFloat(taxDollar) || 0;
  const parsedTip = parseFloat(tipDollar) || 0;
  const extraTotal = extraCharges.reduce((sum, c) => sum + (c.isDiscount ? -c.amount : c.amount), 0);
  const total = subtotal + parsedTax + parsedTip + extraTotal;
  const activeTipPct = parseFloat(tipPct) || 0;
  const selectPreset = (pct: number) => { lightHaptic(); if (activeTipPct === pct) { setTipPct(''); setTipDollar(''); } else { setTipPct(String(pct)); setTipDollar((subtotal * pct / 100).toFixed(2)); } };

  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Modals
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<ItemData | null>(null);
  const [chargeModalVisible, setChargeModalVisible] = useState(false);
  const [chargeModalDiscount, setChargeModalDiscount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (item: ItemData) => { setEditItem(item); setItemModalVisible(true); };

  const handleNext = () => {
    if (items.length === 0) { setError('Add at least one item to continue.'); return; }
    setError(null);
    setTax(parsedTax);
    setTip(parsedTip);
    mediumHaptic();
    router.replace('/people');
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BillHeader />
      <FlowSteps active={0} />

      {/* -- Main scroll -- */}
      {/* No KeyboardAvoidingView — it fights the ScrollView's own native "scroll the focused
          field into view" behavior on iOS and can collapse the whole scroll area to almost
          nothing when the keyboard opens (see manual-entry.tsx and AuthGate.tsx for the same
          failure mode and fix). The plain scroll container already lifts the focused field on
          its own. */}
      <View style={{ flex: 1 }}>
        <NestableScrollContainer style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Line items */}
          <Text style={s.sectionLabel}>LINE ITEMS</Text>
          <View style={s.itemList}>
            <NestableDraggableFlatList
              data={items}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => setItemOrder(data.map((i) => i.id))}
              renderItem={({ item, drag, isActive }) => (
                <ItemRow item={item} onEdit={openEdit} drag={drag} isActive={isActive} />
              )}
              // No activationDistance override — its internal drag-tracking pan gesture uses that
              // value as its own activation threshold for ANY vertical movement in the list, not
              // just while actually dragging a cell (drag only starts via the reorder handle's
              // long-press below). A low value made that gesture win the race against the parent
              // scroll view on every touch, which is exactly what was blocking normal scrolling.
              // The library's own default threshold is tuned to coexist with nested scrolling.
            />
          </View>

          {/* Tax, then any receipt-read charges/discounts, then Tip, then Add charge/discount last */}
          <View style={{ gap: 16, marginTop: 16 }}>
            <View>
              <FieldLabel>Tax</FieldLabel>
              <View style={s.ttRow}>
                <View style={s.ttCol1}>
                  <View style={[s.ttBox, focusedInput === 'taxPct' && s.ttBoxFocused]}>
                    <Text style={s.ttPrefix}>%</Text>
                    <TextInput style={[s.ttInput, { outlineWidth: 0 } as any]} value={taxPct} onChangeText={onTaxPctChange} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.textDim} onFocus={() => setFocusedInput('taxPct')} onBlur={() => setFocusedInput(null)} />
                  </View>
                </View>
                <View style={s.ttCol2}>
                  <View style={[s.ttBox, focusedInput === 'taxDollar' && s.ttBoxFocused]}>
                    <Text style={s.ttPrefix}>$</Text>
                    <TextInput style={[s.ttInput, { outlineWidth: 0 } as any]} value={taxDollar} onChangeText={onTaxDollarChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim} onFocus={() => setFocusedInput('taxDollar')} onBlur={() => setFocusedInput(null)} />
                  </View>
                </View>
              </View>
            </View>

            {extraCharges.map((charge) => (
              <ExtraChargeRow key={charge.id} charge={charge} subtotal={subtotal} focusedInput={focusedInput} setFocusedInput={setFocusedInput} />
            ))}

            <View>
              <FieldLabel>Tip</FieldLabel>
              <View style={s.ttRow}>
                <View style={s.ttCol1}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {[15, 18, 20, 25].map((pct) => (
                      <PressBtn key={pct} style={[s.ttPreset, activeTipPct === pct && s.ttPresetActive]} onPress={() => selectPreset(pct)}>
                        <Text style={[s.ttPresetText, activeTipPct === pct && s.ttPresetTextActive]}>{pct}%</Text>
                      </PressBtn>
                    ))}
                  </View>
                </View>
                <View style={s.ttCol2}>
                  <View style={[s.ttBox, focusedInput === 'tipDollar' && s.ttBoxFocused]}>
                    <Text style={s.ttPrefix}>$</Text>
                    <TextInput style={[s.ttInput, { outlineWidth: 0 } as any]} value={tipDollar} onChangeText={onTipDollarChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim} onFocus={() => setFocusedInput('tipDollar')} onBlur={() => setFocusedInput(null)} />
                  </View>
                </View>
              </View>
            </View>

            <View style={s.ttRow}>
              <View style={s.ttCol1}>
                <Button
                  variant="filterWide" size="small" label="Add charge"
                  icon={<PlusCircleIcon color={C.text} size={14} />}
                  onPress={() => { lightHaptic(); setChargeModalDiscount(false); setChargeModalVisible(true); }}
                  style={{ width: '100%' }}
                />
              </View>
              <View style={s.ttCol2}>
                <Button
                  variant="filterWide" size="small" label="Add discount"
                  icon={<MinusCircleIcon color={C.text} size={14} />}
                  onPress={() => { lightHaptic(); setChargeModalDiscount(true); setChargeModalVisible(true); }}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          </View>

          {/* Totals summary */}
          <View style={s.totalsDivider} />
          <View style={s.totalsSection}>
            <View style={s.sumRow}><Text style={s.sumLabel}>Subtotal</Text><Text style={s.sumValue}>{fmt(subtotal)}</Text></View>
            <View style={s.sumRow}><Text style={s.sumLabel}>Tax</Text><Text style={s.sumValue}>{fmt(parsedTax)}</Text></View>
            <View style={s.sumRow}><Text style={s.sumLabel}>Tip</Text><Text style={s.sumValue}>{fmt(parsedTip)}</Text></View>
            {extraCharges.map((c) => (
              <View key={c.id} style={s.sumRow}>
                <Text style={s.sumLabel}>{c.name}</Text>
                <Text style={[s.sumValue, c.isDiscount && { color: '#4CAF50' }]}>{c.isDiscount ? `-${fmt(c.amount)}` : fmt(c.amount)}</Text>
              </View>
            ))}
            <View style={[s.sumRow, { marginTop: 6 }]}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalBig}>{fmt(total)}</Text>
            </View>
          </View>

          <View style={{ height: 8 }} />
        </NestableScrollContainer>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* -- Footer -- */}
        <View style={s.footer}>
          <Button
            variant="secondary"
            size="big"
            label="Add Item"
            icon={<PlusIcon color={C.text} size={18} />}
            onPress={() => { lightHaptic(); setEditItem(null); setItemModalVisible(true); }}
            style={{ flex: 1 }}
          />
          <Button
            variant="primary"
            size="big"
            label="Add Rats"
            icon={<FriendsIcon color={C.text} size={18} />}
            onPress={handleNext}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <ItemModal visible={itemModalVisible} editItem={editItem} onClose={() => setItemModalVisible(false)} />
      <ChargeModal visible={chargeModalVisible} initialIsDiscount={chargeModalDiscount} subtotal={subtotal} onClose={() => setChargeModalVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Scroll
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 0 },

  sectionLabel: { color: C.textSub, ...Type.fieldLabel, marginBottom: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: C.primaryDim },
  addItemBtnText: { ...Type.pillLabel, color: C.primary },
  addBtn: { borderColor: C.border, borderRadius: 8 },

  itemList: { gap: 6, paddingBottom: 2 },

  // Inline add row
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    borderRadius: InputMetrics.radius, height: InputMetrics.height, paddingHorizontal: 14,
    backgroundColor: C.card,
  },
  addNameInput: { flex: 1, minWidth: 0, color: C.text, ...Type.bodySmall, padding: 0 },
  addSep: { color: C.textDim, ...Type.cardDesc },
  addQtyInput: { width: 28, color: C.text, ...Type.bodySmall, textAlign: 'center', padding: 0 },
  addPriceInput: { width: 52, color: C.text, ...Type.bodySmall, textAlign: 'right', padding: 0 },
  addPlusBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.border, justifyContent: 'center', alignItems: 'center',
  },
  addPlusBtnActive: { backgroundColor: C.primary },

  subLabel: { color: C.text, ...Type.pillLabel, marginTop: 10, marginBottom: 6 },

  // Compact tax/tip rows — fixed 50/50 percentage columns (not flex-grow) so the two
  // columns line up pixel-for-pixel across the Tax/Tip/charge-buttons rows regardless
  // of each column's inner content (pill row vs. box vs. button).
  ttRow: { flexDirection: 'row' },
  ttCol1: { width: '50%', paddingRight: 4 },
  ttCol2: { width: '50%', paddingLeft: 4 },
  ttBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 10 },
  ttBoxFocused: { borderColor: C.primary },
  ttPrefix: { color: C.textSub, ...Type.bodySmall },
  ttInput: { flex: 1, color: C.text, ...Type.bodySmall, padding: 0, minWidth: 0 },
  ttPreset: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  ttPresetActive: { backgroundColor: C.yellow },
  ttPresetText: { color: C.textSub, ...Type.pillLabel },
  ttPresetTextActive: { color: C.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.07)' },
  emptyText: { color: C.textDim, textAlign: 'center', padding: 20, ...Type.cardDesc },

  // Item row — each row is its own rounded card so swipe actions aren't clipped
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, gap: 8, backgroundColor: C.card, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 6 },
  itemRowDragging: { borderColor: C.yellow },
  itemName: { flex: 1, color: C.text, ...Type.bodySmall },
  itemQty: { color: C.textDim, ...Type.labelMedium },
  itemPrice: { color: C.text, ...Type.bodySmall, minWidth: 52, textAlign: 'right' },
  itemModifiers: { color: C.textDim, ...Type.caption, marginTop: 3 },

  actionWrap: { width: 80, justifyContent: 'center', alignItems: 'center' },
  actionPill: {
    height: 36, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingHorizontal: 8, overflow: 'hidden',
  },
  actionLabel: { ...Type.pillLabel },

  chargeHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  chargeNameInput: { flex: 1, minWidth: 0, color: C.textSub, ...Type.fieldLabel, textTransform: 'uppercase', padding: 0 },

  totalsDivider: { height: 1, backgroundColor: C.border, marginTop: 28, marginBottom: 16 },
  totalsSection: { paddingBottom: 8 },

  // Summary
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  sumLabel: { color: C.textSub, ...Type.cardDesc },
  sumValue: { color: C.text, ...Type.pillLabel },
  totalLabel: { color: C.text, ...Type.cardTitle },
  totalBig: { color: C.text, ...Type.h1 },

  // Footer
  footer: { padding: 16, paddingTop: 8, flexDirection: 'row', gap: 10 },
  receiptBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: C.primaryDim, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  errorText: { color: C.error, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4, fontSize: 13 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: C.bg, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, gap: 12 },
  modalTitle: { color: C.text, ...Type.h2, letterSpacing: 0.5 },
  modalLabel: { color: C.textSub, fontSize: 11, fontFamily: 'Poppins_500Medium', marginBottom: 6 },
  modalInput: {},
  modalInputFocused: { borderColor: C.primary },
  modalPriceBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.card, borderRadius: InputMetrics.radius, height: InputMetrics.height, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14 },
  modalPriceDollar: { color: C.textSub, fontSize: 15, fontFamily: 'Poppins_400Regular' },
  modalPriceInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 15, fontFamily: 'Poppins_400Regular', padding: 0 },
  addRowFocused: { borderColor: C.primary, borderStyle: 'solid' },
  inputBoxFocused: { borderColor: C.primary },
  modalSubtotal: { color: C.textSub, fontSize: 13, textAlign: 'right', fontFamily: 'Poppins_400Regular' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4, justifyContent: 'flex-end' },

});
