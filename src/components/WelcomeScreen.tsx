import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { HandCardLeft, HandCardRight } from '@/components/FigmaIcons';
import { mediumHaptic } from '@/utils/haptics';

// Shown once, before AuthGate, on a device that's never gotten past it — same hero/title layout
// as AuthGate (same hand illustration, same title style) but with no form, just what the app is
// for and a way through to sign in/up. _layout.tsx persists "seen" so this never shows again.
export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <View style={s.hero}>
          <View style={s.handLeft}>
            <HandCardLeft size={170} />
          </View>
          <HandCardRight size={170} />
        </View>

        <View style={s.content}>
          <Text style={s.appName}>Tab Rat</Text>
          <Text style={s.subtitle}>let the rat keep the tab</Text>

          <View style={s.wordStack}>
            <Text style={s.wordSplit}>split</Text>
            <Text style={s.wordBill}>bills</Text>
            <Text style={s.wordTrip}>trips</Text>
            <Text style={s.wordHome}>home</Text>
            <Text style={s.wordExpense}>expenses</Text>
          </View>

          <Button
            variant="primary"
            size="big"
            label="Get started"
            onPress={() => { mediumHaptic(); onGetStarted(); }}
            style={s.cta}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  hero: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginBottom: 20,
  },
  content: { width: '100%', alignItems: 'flex-end', paddingHorizontal: 24 },
  handLeft: { marginTop: -150 },
  appName: { ...Type.hero, color: C.text, textAlign: 'right', textTransform: 'uppercase' },
  subtitle: {
    ...Type.h2, color: '#AEB7DE', textAlign: 'right',
    marginTop: 2, marginBottom: 20,
  },
  wordStack: { alignItems: 'flex-end' },
  wordSplit: { ...Type.h3, color: C.text, textAlign: 'right', lineHeight: 26 },
  wordBill: { ...Type.h3, color: C.billBg, textAlign: 'right', lineHeight: 26 },
  wordTrip: { ...Type.h3, color: C.tripBg, textAlign: 'right', lineHeight: 26 },
  wordHome: { ...Type.h3, color: C.homeBg, textAlign: 'right', lineHeight: 26 },
  wordExpense: { ...Type.h3, color: C.yellow, textAlign: 'right', lineHeight: 26 },
  cta: { width: '100%', maxWidth: 340, marginTop: 32, alignSelf: 'center' },
});
