import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { CheckCircleIcon, PencilIcon, PlusIcon, TrashIcon, XMarkIcon } from '@/components/FigmaIcons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, CenteredModal, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { FlowSteps, ReceiptHeader } from '@/components/FlowSteps';
import { useSplitStore } from '@/store/useSplitStore';
import { fmt, sanitizeNumberInput } from '@/utils/calculator';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';
import type { ReceiptItem } from '@/types';

type ItemData = { id: string; name: string; price: number; quantity: number };

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

function ItemRow({ item, onEdit }: { item: ItemData; onEdit: (i: ItemData) => void }) {
  const { removeItem } = useSplitStore();
  const swipeRef = useRef<Swipeable>(null);
  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={(p) => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActionPill progress={p} iconNode={(c) => <PencilIcon color={c} size={15} />} label="Edit" color={C.pillInfo}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); onEdit(item); }} />
          <ActionPill progress={p} iconNode={(c) => <TrashIcon color={c} size={15} />} label="Delete" color={C.error}
            onPress={() => { lightHaptic(); swipeRef.current?.close(); removeItem(item.id); }} />
        </View>
      )}
    >
      <View style={s.itemRow}>
        <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.itemQty}>�{item.quantity}</Text>
        <Text style={s.itemPrice}>{fmt(item.price)}</Text>
      </View>
    </Swipeable>
  );
}

function InlineAddRow({ onAdd }: { onAdd: (name: string, price: number, qty: number) => void }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const canAdd = name.trim().length > 0 && parseFloat(price) > 0;

  const submit = () => {
    if (!canAdd) return;
    lightHaptic();
    onAdd(name.trim(), parseFloat(price) * (parseInt(qty) || 1), parseInt(qty) || 1);
    setName(''); setQty('1'); setPrice('');
  };

  return (
    <View style={s.addRow}>
      <TextInput style={s.addNameInput} placeholder="Item" placeholderTextColor={C.textDim}
        value={name} onChangeText={setName} returnKeyType="next" />
      <Text style={s.addSep}>�</Text>
      <TextInput style={s.addQtyInput} value={qty} onChangeText={(v) => setQty(sanitizeNumberInput(v))}
        keyboardType="number-pad" selectTextOnFocus />
      <Text style={s.addSep}>$</Text>
      <TextInput style={s.addPriceInput} value={price} onChangeText={(v) => setPrice(sanitizeNumberInput(v))}
        keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim}
        onSubmitEditing={submit} returnKeyType="done" />
      <PressBtn style={[s.addPlusBtn, canAdd && s.addPlusBtnActive]}
        onPress={submit} disabled={!canAdd} activeOpacity={0.7}>
        <PlusIcon color={canAdd ? '#fff' : C.textDim} size={18} />
      </PressBtn>
    </View>
  );
}

function ItemModal({ visible, editItem, onClose }: { visible: boolean; editItem: ItemData | null; onClose: () => void }) {
  const { addItemWithDetails, updateItem } = useSplitStore();
  const isEdit = !!editItem;
  const [name, setName] = useState(editItem?.name ?? '');
  const [qty, setQty] = useState(editItem ? String(editItem.quantity || 1) : '1');
  const [unitPrice, setUnitPrice] = useState(
    editItem ? (editItem.quantity > 0 ? editItem.price / editItem.quantity : editItem.price).toFixed(2) : '',
  );

  const prevEdit = useRef<ItemData | null>(null);
  if (prevEdit.current !== editItem) {
    prevEdit.current = editItem;
    if (editItem) {
      setName(editItem.name);
      setQty(String(editItem.quantity || 1));
      setUnitPrice((editItem.quantity > 0 ? editItem.price / editItem.quantity : editItem.price).toFixed(2));
    } else { setName(''); setQty('1'); setUnitPrice(''); }
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
          <Input style={s.modalInput} placeholder="Item name" placeholderTextColor={C.textDim}
            value={name} onChangeText={setName} autoFocus={!isEdit} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalLabel}>Qty</Text>
              <Input style={s.modalInput} value={qty} onChangeText={(v) => setQty(sanitizeNumberInput(v))}
                keyboardType="number-pad" placeholder="1" placeholderTextColor={C.textDim} />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={s.modalLabel}>Unit price</Text>
              <Input style={s.modalInput} value={unitPrice} onChangeText={(v) => setUnitPrice(sanitizeNumberInput(v))}
                keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim} />
            </View>
          </View>
          {parsedQty > 1 && parsedUnit > 0 && <Text style={s.modalSubtotal}>Total: {fmt(total)}</Text>}
          <View style={s.modalBtns}>
            <Button variant="secondary" size="small" label="Cancel" onPress={onClose} />
            <Button
              variant="primary"
              size="small"
              label={isEdit ? 'Save' : 'Add'}
              onPress={submit}
              disabled={!name.trim() || parsedUnit <= 0}
            />
          </View>
    </CenteredModal>
  );
}

export default function ExpenseEntryScreen() {
  const router = useRouter();
  const {
    items, restaurantName, expenseCategory, expenseCategories,
    setRestaurantName, setExpenseCategory, addExpenseCategory, addItemWithDetails,
  } = useSplitStore();

  const [title, setTitle] = useState(restaurantName);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [editItem, setEditItem] = useState<ItemData | null>(null);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((s, i) => s + i.price, 0);

  const commitTitle = () => {
    setRestaurantName(title.trim());
    setEditingTitle(false);
  };

  const handleAddCategory = () => {
    const cat = newCatInput.trim();
    if (!cat) return;
    addExpenseCategory(cat);
    setExpenseCategory(cat);
    setNewCatInput('');
    setShowNewCat(false);
  };

  const handleNext = () => {
    const t = title.trim();
    if (!t) { setError('Enter a title for this expense.'); return; }
    if (items.length === 0) { setError('Add at least one item to continue.'); return; }
    setRestaurantName(t);
    setError(null);
    mediumHaptic();
    router.push('/people');
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Title + Category header */}
      <View style={s.header}>
        <PressBtn onLongPress={() => setEditingTitle(true)} delayLongPress={350}
          activeOpacity={0.85} style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <TextInput autoFocus style={s.titleInput} value={title} onChangeText={setTitle}
              onBlur={commitTitle} onSubmitEditing={commitTitle}
              placeholder="Expense title" placeholderTextColor={C.textDim} />
          ) : (
            <Text style={s.titleText} numberOfLines={1}
              onPress={() => setEditingTitle(true)}>
              {title || 'Expense title'}
            </Text>
          )}
        </PressBtn>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catsRow} style={s.catsScroll}>
        {expenseCategories.map((cat) => (
          <PressBtn
            key={cat}
            style={[s.catChip, expenseCategory === cat && s.catChipActive]}
            onPress={() => { selectionHaptic(); setExpenseCategory(expenseCategory === cat ? null : cat); }}
            activeOpacity={0.7}
          >
            <Text style={[s.catChipText, expenseCategory === cat && s.catChipTextActive]}>{cat}</Text>
          </PressBtn>
        ))}
        {showNewCat ? (
          <View style={s.newCatRow}>
            <TextInput style={s.newCatInput} value={newCatInput} onChangeText={setNewCatInput}
              placeholder="Category name" placeholderTextColor={C.textDim}
              autoFocus onSubmitEditing={handleAddCategory} returnKeyType="done" />
            <PressBtn onPress={handleAddCategory} activeOpacity={0.7} style={s.newCatConfirm}>
              <CheckCircleIcon size={15} color={C.primary} />
            </PressBtn>
            <PressBtn onPress={() => { setShowNewCat(false); setNewCatInput(''); }}
              activeOpacity={0.7}>
              <XMarkIcon size={15} color={C.textDim} />
            </PressBtn>
          </View>
        ) : (
          <PressBtn style={s.catChipAdd}
            onPress={() => { selectionHaptic(); setShowNewCat(true); }} activeOpacity={0.7}>
            <PlusIcon color={C.text} size={14} />
            <Text style={s.catChipAddText}>Add</Text>
          </PressBtn>
        )}
      </ScrollView>

      <FlowSteps active={0} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionLabel}>ITEMS</Text>
          <View style={s.itemList}>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} onEdit={(i) => { setEditItem(i); setItemModalVisible(true); }} />
            ))}
            <InlineAddRow onAdd={(name, price, qty) => addItemWithDetails(name, price, qty)} />
          </View>

          {items.length > 0 && (
            <View style={s.subtotalRow}>
              <Text style={s.subtotalLabel}>Total</Text>
              <Text style={s.subtotalAmt}>{fmt(subtotal)}</Text>
            </View>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        <View style={s.footer}>
          <Button variant="primary" size="big" label="Add People" onPress={handleNext} style={s.nextBtn} />
        </View>
      </KeyboardAvoidingView>

      <ItemModal visible={itemModalVisible} editItem={editItem} onClose={() => setItemModalVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 10,
  },
  titleText: { color: C.text, fontFamily: 'Poppins_900Black', fontSize: 28, letterSpacing: 0.5 },
  titleInput: {
    color: C.text, fontFamily: 'Poppins_900Black', fontSize: 28, letterSpacing: 0.5,
    padding: 0, borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 2,
  },

  catsScroll: { flexGrow: 0 },
  catsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    paddingVertical: 8, alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.textSub },
  catChipTextActive: { color: '#fff' },
  catChipAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: C.textDim, borderStyle: 'dashed',
  },
  catChipAddText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.textSub },
  newCatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.card, borderRadius: 999, borderWidth: 1, borderColor: C.primary,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  newCatInput: {
    fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text,
    minWidth: 100, padding: 0,
  },
  newCatConfirm: { padding: 2 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  sectionLabel: {
    color: C.textSub, fontSize: 11, fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.8, marginBottom: 6,
  },
  itemList: { gap: 6 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    gap: 6, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  itemName: { flex: 1, color: C.text, fontSize: 15, fontFamily: 'Poppins_400Regular' },
  itemQty: { color: C.textDim, fontSize: 13, fontFamily: 'Poppins_500Medium', marginRight: 4 },
  itemPrice: { color: C.text, fontSize: 15, fontFamily: 'Poppins_400Regular', minWidth: 52, textAlign: 'right' },

  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    borderRadius: InputMetrics.radius, paddingHorizontal: 14, height: InputMetrics.height, backgroundColor: C.card,
  },
  addNameInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 15, fontFamily: 'Poppins_400Regular', padding: 0 },
  addSep: { color: C.textDim, fontSize: 14 },
  addQtyInput: { width: 28, color: C.text, fontSize: 15, fontFamily: 'Poppins_400Regular', textAlign: 'center', padding: 0 },
  addPriceInput: { width: 52, color: C.text, fontSize: 15, fontFamily: 'Poppins_400Regular', textAlign: 'right', padding: 0 },
  addPlusBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.border, justifyContent: 'center', alignItems: 'center',
  },
  addPlusBtnActive: { backgroundColor: C.primary },

  subtotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  subtotalLabel: { color: C.text, fontSize: 15, fontFamily: 'Poppins_700Bold' },
  subtotalAmt: { color: C.text, fontFamily: 'Poppins_900Black', fontSize: 28 },

  actionWrap: { width: 80, justifyContent: 'center', alignItems: 'center' },
  actionPill: {
    height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4, paddingHorizontal: 8, overflow: 'hidden',
  },
  actionLabel: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  nextBtn: { flex: 1 },
  errorText: { color: C.error, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4, fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: C.bg, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, gap: 12 },
  modalTitle: { color: C.text, fontFamily: 'Poppins_900Black', fontSize: 22, letterSpacing: 0.5 },
  modalLabel: { color: C.textSub, fontSize: 11, fontFamily: 'Poppins_500Medium', marginBottom: 6 },
  modalInput: {},
  modalSubtotal: { color: C.textSub, fontSize: 13, textAlign: 'right', fontFamily: 'Poppins_400Regular' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4, justifyContent: 'flex-end' },
});
