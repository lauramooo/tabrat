import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar, Text } from 'react-native-paper';
import { Button, Card } from '@/components/design';
import { BillHeader, FlowSteps } from '@/components/FlowSteps';
import { ChevronDownCircleIcon, ChevronUpCircleIcon, ScissorIcon } from '@/components/FigmaIcons';
import { PersonChip } from '@/components/PersonChip';
import { C } from '@/constants/colors';
import { useSplitStore } from '@/store/useSplitStore';
import { useMyName, sortWithMeFirst } from '@/utils/sortPeople';
import { fmt } from '@/utils/calculator';
import { errorHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

const ITEM_CATEGORIES = ['All', 'Drinks', 'Apps', 'Mains', 'Dessert', 'Sides', 'Other'];

export default function AssignScreen() {
  const router = useRouter();
  const {
    items, people,
    toggleAssignment, setItemAssignees, splitItemQtyAssigned,
  } = useSplitStore();

  const myName = useMyName();
  const sortedPeople = sortWithMeFirst(people, myName);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');

  // Local expand state � subAssigns[itemId][unitIdx] = personId[]
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [subAssigns, setSubAssigns] = useState<Record<string, string[][]>>({});

  const toggleExpand = (itemId: string, qty: number) => {
    selectionHaptic();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
        setSubAssigns((s) => {
          if (s[itemId]) return s;
          return { ...s, [itemId]: Array.from({ length: qty }, () => []) };
        });
      }
      return next;
    });
  };

  const toggleSubAssign = (itemId: string, unitIdx: number, personId: string) => {
    selectionHaptic();
    setSubAssigns((prev) => {
      const units = [...(prev[itemId] ?? [])];
      const unit = [...(units[unitIdx] ?? [])];
      units[unitIdx] = unit.includes(personId)
        ? unit.filter((id) => id !== personId)
        : [...unit, personId];
      return { ...prev, [itemId]: units };
    });
  };

  const setAllSubUnit = (itemId: string, unitIdx: number, personIds: string[]) => {
    selectionHaptic();
    setSubAssigns((prev) => {
      const units = [...(prev[itemId] ?? [])];
      units[unitIdx] = personIds;
      return { ...prev, [itemId]: units };
    });
  };

  // Which categories actually appear in the items
  const usedCategories = ['All', ...ITEM_CATEGORIES.slice(1).filter(
    (cat) => items.some((i) => (i.category ?? 'Other') === cat || (cat === 'Other' && !i.category)),
  )];

  const filteredItems = activeCategory === 'All'
    ? items
    : items.filter((i) => (i.category ?? 'Other') === activeCategory);

  // Progress � expanded items count as assigned only if all sub-units are assigned
  const assignedCount = items.filter((i) => {
    if (expanded.has(i.id) && i.quantity > 1) {
      const subs = subAssigns[i.id];
      return subs ? subs.every((u) => u.length > 0) : false;
    }
    return i.assignedTo.length > 0;
  }).length;
  const progress = items.length > 0 ? assignedCount / items.length : 0;

  // Bake expanded sub-assignments into the store, then navigate
  const bakeAndPush = () => {
    for (const itemId of Array.from(expanded)) {
      const item = items.find((i) => i.id === itemId);
      if (!item || item.quantity <= 1) continue;
      const unitAssigns = subAssigns[itemId] ?? Array.from({ length: item.quantity }, () => []);
      splitItemQtyAssigned(itemId, unitAssigns);
    }
    mediumHaptic();
    router.replace('/summary');
  };

  const handleSplit = () => {
    const unassigned = items.filter((i) => {
      if (expanded.has(i.id) && i.quantity > 1) {
        const subs = subAssigns[i.id];
        return !subs || subs.some((u) => u.length === 0);
      }
      return i.assignedTo.length === 0;
    });
    if (unassigned.length > 0) {
      errorHaptic();
      setError(`${unassigned.length} item(s) unassigned. Tap Split again to continue anyway.`);
      return;
    }
    setError(null);
    bakeAndPush();
  };

  const handleSplitForce = () => {
    setError(null);
    bakeAndPush();
  };


  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BillHeader />
      <FlowSteps active={2} />

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text variant="labelMedium" style={styles.progressLabel}>{assignedCount} of {items.length} assigned</Text>
          <Text variant="labelMedium" style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
        </View>
        <ProgressBar progress={progress} color="#F7D76A" style={styles.progressBar} />
      </View>

      {/* Category filter */}
      {usedCategories.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow} style={styles.catScroll}>
          {usedCategories.map((cat) => (
            <PressBtn
              key={cat}
              style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
              onPress={() => { selectionHaptic(); setActiveCategory(cat); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>{cat}</Text>
            </PressBtn>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filteredItems.map((item) => {
          const allIds = people.map((p) => p.id);
          const isExpanded = expanded.has(item.id) && item.quantity > 1;
          const allAssigned = people.length > 0 && item.assignedTo.length === people.length;
          const unitPrice = item.price / item.quantity;

          return (
            <Card key={item.id} padding={11} radius={10} row={false} style={styles.card}>
              {/* Card header */}
              <View style={styles.cardHeader}>
                <Text variant="titleMedium" style={styles.itemName} numberOfLines={2}>
                  {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </Text>
                <Text variant="titleMedium" style={styles.itemPrice}>{fmt(item.price)}</Text>
                {item.quantity > 1 && (
                  <PressBtn
                    onPress={() => toggleExpand(item.id, item.quantity)}
                    hitSlop={8}
                    style={styles.expandBtn}
                    activeOpacity={1}
                    noShadow
                  >
                    {isExpanded
                      ? <ChevronUpCircleIcon color={C.text} size={15} />
                      : <ChevronDownCircleIcon color={C.text} size={15} />}
                  </PressBtn>
                )}
              </View>

              {/* Expanded sub-rows */}
              {isExpanded ? (
                <View style={styles.subRows}>
                  {Array.from({ length: item.quantity }, (_, unitIdx) => {
                    const unitAssignees = subAssigns[item.id]?.[unitIdx] ?? [];
                    const allUnitAssigned = people.length > 0 && unitAssignees.length === people.length;
                    return (
                      <View key={unitIdx} style={[styles.subRow, unitIdx === 0 && styles.subRowFirst]}>
                        <Text style={styles.subRowPrice}>{fmt(unitPrice)}</Text>
                        <View style={styles.subChips}>
                          {sortedPeople.map((person, i) => {
                            const selected = unitAssignees.includes(person.id);
                            return (
                              <PersonChip
                                key={person.id}
                                name={person.name}
                                index={i}
                                selected={selected}
                                size="sm"
                                onPress={() => toggleSubAssign(item.id, unitIdx, person.id)}
                              />
                            );
                          })}
                        </View>
                        <PressBtn
                          style={[styles.allBtn, allUnitAssigned && styles.allBtnActive]}
                          onPress={() => setAllSubUnit(item.id, unitIdx, allUnitAssigned ? [] : allIds)}
                        >
                          <Text style={[styles.allBtnText, allUnitAssigned && styles.allBtnTextActive]}>All</Text>
                        </PressBtn>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <>
                  <View style={styles.chipsRow}>
                    <View style={styles.chips}>
                      {sortedPeople.map((person, i) => {
                        const selected = item.assignedTo.includes(person.id);
                        return (
                          <PersonChip
                            key={person.id}
                            name={person.name}
                            index={i}
                            selected={selected}
                            size="sm"
                            onPress={() => { selectionHaptic(); toggleAssignment(item.id, person.id); }}
                          />
                        );
                      })}
                    </View>
                    <View style={styles.chipSep} />
                    <PressBtn
                      style={[styles.allBtn, allAssigned && styles.allBtnActive]}
                      onPress={() => { selectionHaptic(); setItemAssignees(item.id, allAssigned ? [] : allIds); }}
                    >
                      <Text style={[styles.allBtnText, allAssigned && styles.allBtnTextActive]}>All</Text>
                    </PressBtn>
                  </View>
                  {item.assignedTo.length > 1 && (
                    <Text variant="bodySmall" style={styles.splitNote}>
                      Split {item.assignedTo.length} ways · {fmt(item.price / item.assignedTo.length)} each
                    </Text>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {error ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant="primary" size="big" label="Split Anyway" icon={<ScissorIcon color={C.text} size={18} />} onPress={handleSplitForce} />
          </View>
        ) : (
          <Button variant="primary" size="big" label="Split" icon={<ScissorIcon color={C.text} size={18} />} onPress={handleSplit} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  progressSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: C.textSub },
  progressPct: { color: C.text, fontWeight: '700' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: C.border },

  catScroll: { maxHeight: 46 },
  catRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  catChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: C.textSub },
  catChipTextActive: { color: '#fff', fontFamily: 'Poppins_600SemiBold' },

  scroll: { flex: 1 },
  content: { padding: 12, gap: 8, paddingBottom: 8 },
  card: { gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemName: { flex: 1, color: C.text },
  itemPrice: { color: C.text, fontWeight: '700' },
  expandBtn: { paddingLeft: 4, paddingTop: 2 },

  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipSep: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.12)', marginHorizontal: 2 },
  allBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: 'transparent' },
  allBtnActive: { backgroundColor: '#F7D76A', borderColor: '#1A1A1A' },
  allBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textSub },
  allBtnTextActive: { color: C.text },
  splitNote: { color: C.textSub },

  // Sub-rows (expanded qty view)
  subRows: { gap: 0 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingTop: 10, paddingBottom: 4,
  },
  subRowFirst: { marginTop: -4 },
  subRowNum: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: C.textDim, width: 14, textAlign: 'center' },
  subRowPrice: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: C.textSub, minWidth: 36 },
  subChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  footer: { padding: 16, paddingTop: 8 },
  errorText: { color: C.error, fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
});
