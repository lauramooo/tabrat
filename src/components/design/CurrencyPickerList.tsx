import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CheckCircleIcon, SearchIcon } from '@/components/FigmaIcons';
import { CURRENCIES } from '@/constants/currencies';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { DropdownRow } from './DropdownRow';

/**
 * The searchable currency list shown inside a Dropdown (see trip/new.tsx and trip/[id].tsx) —
 * shared so both places stay in sync rather than re-implementing the same filter/row markup.
 * Pass `scroll={false}` to the surrounding <Dropdown> since this manages its own scroll region
 * below the pinned search field.
 */
export function CurrencyPickerList({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter((c) =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [search]);

  return (
    <>
      <View style={s.searchRow}>
        <SearchIcon size={14} color={C.textDim} />
        <TextInput
          style={[s.searchInput, { outlineWidth: 0 } as any]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search currency or country"
          placeholderTextColor={C.textDim}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
        {filtered.length === 0 ? (
          <Text style={s.emptyText}>No currencies match "{search}"</Text>
        ) : (
          filtered.map((c, i) => {
            const active = selected.includes(c.code);
            return (
              <DropdownRow
                key={c.code}
                onPress={() => onToggle(c.code)}
                divider={i > 0}
                trailing={active ? <CheckCircleIcon size={15} color={C.text} filled fillColor={C.yellow} /> : undefined}
              >
                <Text style={s.rowText}>
                  <Text style={{ color: C.text }}>{c.symbol}</Text>
                  <Text style={{ color: C.textSub }}>  {c.code} · {c.name}</Text>
                </Text>
              </DropdownRow>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  searchInput: { flex: 1, ...Type.bodySmall, color: C.text, padding: 0 },
  rowText: { ...Type.labelMedium, color: C.text },
  emptyText: { ...Type.cardDesc, color: C.textSub, textAlign: 'center', padding: 16 },
});
