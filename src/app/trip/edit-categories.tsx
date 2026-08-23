import { PressBtn } from '@/components/PressBtn';
import { CheckCircleIcon, PencilIcon, PlusIcon, XMarkIcon } from '@/components/FigmaIcons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, Card, Divider, FieldLabel, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';
import { useSplitStore } from '@/store/useSplitStore';
import { lightHaptic, mediumHaptic } from '@/utils/haptics';

export default function EditCategoriesScreen() {
  const router = useRouter();
  const { expenseCategories, addExpenseCategory, updateExpenseCategory, removeExpenseCategory } = useSplitStore();

  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleAdd = () => {
    const t = newCat.trim();
    if (!t) return;
    lightHaptic();
    addExpenseCategory(t);
    setNewCat('');
  };

  const commitEdit = (original: string) => {
    const t = editValue.trim();
    if (t && t !== original) {
      mediumHaptic();
      updateExpenseCategory(original, t);
    }
    setEditingCat(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          <Text style={s.hint}>
            Add categories here or add them as you enter expenses.
          </Text>

          <Card padding={0} row={false} style={s.card}>
            {expenseCategories.length === 0 && (
              <View style={s.emptyRow}>
                <Text style={s.emptyText}>No categories yet.</Text>
              </View>
            )}
            {expenseCategories.map((cat, i) => (
              <View key={cat}>
                {i > 0 && <Divider />}
                <View style={s.catRow}>
                  {editingCat === cat ? (
                    <TextInput
                      style={s.catEditInput}
                      value={editValue}
                      onChangeText={setEditValue}
                      autoFocus
                      onBlur={() => commitEdit(cat)}
                      onSubmitEditing={() => commitEdit(cat)}
                      returnKeyType="done"
                      selectTextOnFocus
                    />
                  ) : (
                    <Text style={s.catName}>{cat}</Text>
                  )}
                  <PressBtn
                    style={s.actionBtn}
                    hitSlop={8}
                    onPress={() => {
                      lightHaptic();
                      if (editingCat === cat) {
                        commitEdit(cat);
                      } else {
                        setEditingCat(cat);
                        setEditValue(cat);
                      }
                    }}
                  >
                    {editingCat === cat
                      ? <CheckCircleIcon size={15} color={C.primary} />
                      : <PencilIcon color={C.textDim} size={18} />}
                  </PressBtn>
                  <PressBtn
                    style={s.actionBtn}
                    hitSlop={8}
                    onPress={() => {
                      lightHaptic();
                      if (editingCat === cat) setEditingCat(null);
                      removeExpenseCategory(cat);
                    }}
                  >
                    <XMarkIcon size={18} color={C.error} />
                  </PressBtn>
                </View>
              </View>
            ))}
          </Card>

          <FieldLabel>ADD CATEGORY</FieldLabel>
          <View style={s.addRow}>
            <Input
              ref={inputRef}
              style={s.addInput}
              value={newCat}
              onChangeText={setNewCat}
              placeholder="New category name"
              placeholderTextColor={C.textDim}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <PressBtn
              style={[s.addBtn, newCat.trim() && { backgroundColor: C.text }]}
              onPress={handleAdd}
              disabled={!newCat.trim()}
              activeOpacity={0.7}
            >
              <PlusIcon color={newCat.trim() ? '#fff' : C.textDim} size={20} />
            </PressBtn>
          </View>

          <Button
            variant="primary"
            size="big"
            label="Done"
            onPress={() => router.back()}
            style={{ marginTop: 4 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },

  hint: {
    fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textDim,
    lineHeight: 18, paddingHorizontal: 2,
  },

  card: { overflow: 'hidden' },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  catName: { flex: 1, fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.text },
  catEditInput: {
    flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 15, color: C.text,
    padding: 0, borderBottomWidth: 1.5, borderBottomColor: C.primary, paddingBottom: 2,
  },
  actionBtn: { padding: 2 },
  emptyRow: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textDim },

  addRow: { flexDirection: 'row', gap: 10 },
  addInput: { flex: 1 },
  addBtn: {
    width: InputMetrics.height, height: InputMetrics.height, borderRadius: InputMetrics.radius,
    backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center',
  },
});
