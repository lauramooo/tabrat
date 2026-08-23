import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { PressBtn } from '@/components/PressBtn';
import { CenteredModal } from './CenteredModal';
import { C } from '@/constants/colors';
import { Radius } from '@/constants/spacing';

export function DatePickerModal({
  visible, value, onChange, onClose, title,
}: {
  visible: boolean; value: Date; onChange: (d: Date) => void; onClose: () => void; title?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (visible) setDraft(value); }, [visible, value]);

  const confirm = () => { onChange(draft); onClose(); };

  return (
    <CenteredModal visible={visible} onClose={onClose} padding={0} radius={Radius.xl} showClose={false}>
      <View style={s.header}>
        <PressBtn onPress={onClose}>
          <Text style={s.cancel}>Cancel</Text>
        </PressBtn>
        <Text style={s.title}>{title ?? 'Select date'}</Text>
        <PressBtn onPress={confirm}>
          <Text style={s.done}>Done</Text>
        </PressBtn>
      </View>
      <DateTimePicker value={draft} mode="date" display="spinner"
        onChange={(_, d) => { if (d) setDraft(d); }}
        style={{ width: '100%' }} />
    </CenteredModal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: C.text },
  cancel: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.textSub },
  done: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: C.primary },
});
