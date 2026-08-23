import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PencilIcon } from '@/components/FigmaIcons';
import { PressBtn } from '@/components/PressBtn';
import { C } from '@/constants/colors';
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
    <View style={styles.row}>
      <Text style={compact ? styles.textCompact : styles.text} numberOfLines={numberOfLines}>{value || fallback}</Text>
      <PressBtn onPress={() => setEditing(true)} hitSlop={8} noShadow>
        <PencilIcon color={C.textSub} size={14} />
      </PressBtn>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: C.text, lineHeight: 20, flexShrink: 1 },
  input: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 15, borderColor: C.text },
  textCompact: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: C.text, flexShrink: 1 },
  inputCompact: {
    flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 15, color: C.text, borderColor: C.text,
    height: 32, minHeight: 32, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 0,
  },
});
