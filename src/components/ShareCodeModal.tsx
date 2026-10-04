import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button, CenteredModal } from '@/components/design';
import { SendIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { mediumHaptic } from '@/utils/haptics';
import { shareText } from '@/utils/share';

// One shared "share this join code" modal for bills, trips, and homes, so the copy/share
// treatment never drifts out of sync between the three contexts it's used from.
export function ShareCodeModal({ visible, onClose, title, code, message }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  code: string | undefined;
  message: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const handleShare = async () => {
    mediumHaptic();
    const didCopy = await shareText(message);
    if (didCopy) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <CenteredModal visible={visible} onClose={onClose} title={<Text style={s.title}>{title}</Text>}>
      <View style={{ gap: 16 }}>
        <Text style={s.hint}>Share this code so someone else can join as a full collaborator.</Text>
        <View style={s.codeBox}>
          <Text style={s.codeText}>{code}</Text>
        </View>
        <Button
          variant="primary"
          size="big"
          label={copied ? 'Copied!' : 'Share code'}
          icon={<SendIcon color={C.text} size={17} />}
          onPress={handleShare}
        />
      </View>
    </CenteredModal>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: 'Poppins_900Black', fontSize: 20, color: C.text },
  hint: { ...Type.cardDesc, color: C.textSub },
  codeBox: {
    backgroundColor: C.card, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  codeText: { ...Type.h1, color: C.text, letterSpacing: 6 },
});
