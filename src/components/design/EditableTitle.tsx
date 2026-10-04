import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PencilIcon } from '@/components/FigmaIcons';
import { PressBtn } from '@/components/PressBtn';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { Input } from './Input';

/**
 * Tap-the-pencil-to-edit title: shows bold display text with a small pencil icon; tapping the
 * pencil swaps it for an autofocused Input; blurring or submitting swaps back. Owns its own
 * edit-mode toggle so callers only need to supply the value and a change handler — nothing else
 * about this interaction varies from screen to screen, so this is the one place it's defined.
 * One canonical style everywhere (trip/[id].tsx's EditTripModal is the reference) — do not
 * reintroduce per-screen size variants.
 */
export function EditableTitle({
  value, onChangeText, placeholder, fallback, numberOfLines = 1, compact = false,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  fallback: string;
  numberOfLines?: number;
  /** For a native header bar, which is much shorter than a modal card — same interaction,
   * just a smaller box so it doesn't dwarf the header. Leave false everywhere else. */
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Input
        style={compact ? styles.inputCompact : styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        autoFocus
        onBlur={() => setEditing(false)}
        onSubmitEditing={() => setEditing(false)}
        returnKeyType="done"
      />
    );
  }

  return (
    <View style={[styles.row, !compact && styles.rowTall]}>
      <Text style={compact ? styles.textCompact : styles.text} numberOfLines={numberOfLines}>{value || fallback}</Text>
      <PressBtn onPress={() => setEditing(true)} hitSlop={8} noShadow>
        <PencilIcon color={C.textSub} size={14} />
      </PressBtn>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // React Native's own text-box measurement for a bold, large font combined with numberOfLines={1}
  // can come out shorter than the specified lineHeight — the style is applied correctly (verified
  // at runtime) but the box RN allocates for it clips the bottom of descenders regardless. A hard
  // minHeight on the row, independent of the Text's own self-measurement, is what actually fixes
  // that rather than adjusting the text style further (already tried and confirmed not the cause).
  rowTall: { minHeight: 40 },
  // Every non-compact usage of this component IS a modal's title (see usages) — Type.h2 matches
  // the size every other (non-editable) modal title in the app uses; this was previously
  // Type.cardTitle, sized for a card row rather than a modal header, which read as much too small.
  text: { ...Type.h2, color: C.text, lineHeight: 32, flexShrink: 1 },
  input: { flex: 1, ...Type.h2, color: C.text, lineHeight: 32, borderColor: C.text, height: 52, minHeight: 52 },
  textCompact: { ...Type.cardTitle, color: C.text, flexShrink: 1 },
  inputCompact: {
    flex: 1, ...Type.cardTitle, color: C.text, borderColor: C.text,
    height: 32, minHeight: 32, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 0,
  },
});
