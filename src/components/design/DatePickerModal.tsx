import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { PressBtn } from '@/components/PressBtn';
import { CenteredModal } from './CenteredModal';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { Radius } from '@/constants/spacing';

export function DatePickerModal({
  visible, value, onChange, onClose, title,
}: {
  visible: boolean; value: Date; onChange: (d: Date) => void; onClose: () => void; title?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    // Without this, a text field's keyboard could still be up underneath the calendar (e.g.
    // tapping the date row while a name field is still focused) — the two competed for the
    // bottom of the screen instead of the keyboard cleanly getting out of the way.
    Keyboard.dismiss();
  }, [visible, value]);

  const confirm = () => { onChange(draft); onClose(); };

  return (
    <CenteredModal visible={visible} onClose={onClose} padding={0} radius={Radius.xl} showClose={false}>
      <View style={s.header}>
        <PressBtn onPress={onClose}>
          <Text style={s.cancel}>Cancel</Text>
        </PressBtn>
        <Text style={s.title}>{title ?? 'Select date'}</Text>
        <View style={{ width: 46 }} />
      </View>
      {/* "spinner" display has a known iOS bug where it can render with zero visible height —
          "inline" is what every other date picker in the app already uses, and it works. Letting
          it size itself (rather than forcing width:'100%' on the native view, which it doesn't
          always honor) and centering it in its wrapper is what keeps it from rendering shifted
          off to one side. */}
      <View style={{ alignItems: 'center', overflow: 'hidden' }}>
        <DateTimePicker value={draft} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => { if (d) setDraft(d); }}
          themeVariant="light" />
      </View>
      <View style={s.footer}>
        <PressBtn onPress={confirm} style={s.doneBtn}>
          <Text style={s.done}>Done</Text>
        </PressBtn>
      </View>
    </CenteredModal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: C.text },
  cancel: { ...Type.labelMedium, color: C.textSub },
  footer: { alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  done: { ...Type.button, color: C.primary },
});
