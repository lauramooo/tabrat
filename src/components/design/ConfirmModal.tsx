import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from './Button';
import { CenteredModal } from './CenteredModal';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';

export function ConfirmModal({
  visible, onClose, onConfirm, title, body, icon,
  cancelLabel = 'Cancel', confirmLabel, confirmVariant = 'primary', confirmIcon,
}: {
  visible: boolean; onClose: () => void; onConfirm: () => void;
  title: string; body: string; icon?: React.ReactNode;
  cancelLabel?: string; confirmLabel: string; confirmVariant?: 'primary' | 'destructive'; confirmIcon?: React.ReactNode;
}) {
  return (
    <CenteredModal visible={visible} onClose={onClose} title={<Text style={{ ...Type.h1, color: C.text }}>{title}</Text>}>
      {icon}
      <Text style={{ ...Type.body, color: C.textSub }}>{body}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="small" label={cancelLabel} onPress={onClose} />
        <Button
          variant={confirmVariant === 'destructive' ? 'destructive' : 'primary'}
          size="small"
          label={confirmLabel}
          icon={confirmIcon}
          onPress={onConfirm}
        />
      </View>
    </CenteredModal>
  );
}
