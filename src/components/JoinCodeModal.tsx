import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native';
import { Button, CenteredModal, FieldLabel, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { errorMessage } from '@/utils/errors';
import { mediumHaptic } from '@/utils/haptics';
import { useRedeemJoinCode } from '@/utils/useRedeemJoinCode';
import { Text } from '@/components/design/Text';

// Redeems a trip/home/bill share code and jumps straight to what was joined. Shared by the Feed
// header's "Join tab" button and the "+" FAB sheet so there's one join flow, not two.
export function JoinCodeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const redeem = useRedeemJoinCode();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => { setCode(''); setError(null); onClose(); };

  const handleJoin = async () => {
    if (!code.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      await redeem(code);
      mediumHaptic();
      handleClose();
    } catch (e) {
      setError(errorMessage(e, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal visible={visible} onClose={handleClose} title={<Text style={s.title}>Join with code</Text>}>
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <FieldLabel style={{ marginBottom: 0 }}>CODE</FieldLabel>
          <Input
            value={code}
            onChangeText={(t) => { setCode(t.replace(/\D/g, '')); setError(null); }}
            placeholder="123456"
            keyboardType="number-pad"
            autoCorrect={false}
            maxLength={6}
            onSubmitEditing={handleJoin}
            returnKeyType="done"
          />
        </View>
        {!!error && <Text style={s.errorText}>{error}</Text>}
        <Button
          variant="primary" size="big"
          label={loading ? 'Joining…' : 'Join'}
          onPress={handleJoin}
          disabled={loading || !code.trim()}
        />
      </View>
    </CenteredModal>
  );
}

const s = StyleSheet.create({
  title: { ...Type.h2, color: C.text },
  errorText: { ...Type.cardDesc, color: C.error },
});
