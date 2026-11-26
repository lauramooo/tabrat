import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/design';
import { Text } from '@/components/design/Text';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { errorMessage } from '@/utils/errors';
import { mediumHaptic } from '@/utils/haptics';
import { useRedeemJoinCode } from '@/utils/useRedeemJoinCode';

// Opened by a tap-to-join link (tabrat://join/<code>, handed off from docs/join.html): redeems
// the code straight away and replaces itself with the trip/home/bill that was joined.
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const redeem = useRedeemJoinCode();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    redeem(code, { replace: true })
      .then(() => mediumHaptic())
      .catch((e) => setError(errorMessage(e, 'Invalid code')));
  }, [code]);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      <View style={s.center}>
        {error ? (
          <>
            <Text style={s.title}>{"Couldn't join"}</Text>
            <Text style={s.body}>{`The code ${code} didn't work — it may have changed. Ask for a new link, or enter the code from the feed's "Join tab" button.`}</Text>
            <Button variant="primary" size="big" label="Go to feed" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
          </>
        ) : (
          <Text style={s.body}>Joining…</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { ...Type.h2, color: C.text },
  body: { ...Type.bodySmall, color: C.textSub, textAlign: 'center' },
});
