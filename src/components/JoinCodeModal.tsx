import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Button, CenteredModal, FieldLabel, Input } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { pullRemoteStateAndReplace } from '@/lib/authSync';
import { joinByCode, syncUserId } from '@/lib/sync';
import { useSplitStore } from '@/store/useSplitStore';
import { errorMessage } from '@/utils/errors';
import { mediumHaptic } from '@/utils/haptics';

// Redeems a trip/home/bill share code and jumps straight to what was joined. Shared by the Feed
// header's "Join tab" button and the "+" FAB sheet so there's one join flow, not two.
export function JoinCodeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { loadSplit } = useSplitStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => { setCode(''); setError(null); onClose(); };

  const handleJoin = async () => {
    if (!code.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { kind, itemId } = await joinByCode(code.trim());
      if (syncUserId) await pullRemoteStateAndReplace(syncUserId);
      mediumHaptic();
      handleClose();
      if (kind === 'trip') router.push({ pathname: '/trip/[id]', params: { id: itemId } });
      else if (kind === 'home') router.push({ pathname: '/home/[id]', params: { id: itemId } });
      else {
        const record = useSplitStore.getState().history.find((r) => r.id === itemId);
        if (record) { loadSplit(record, true); router.push('/summary'); }
      }
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
            onChangeText={(t) => { setCode(t.toUpperCase()); setError(null); }}
            placeholder="ABC123"
            autoCapitalize="characters"
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
