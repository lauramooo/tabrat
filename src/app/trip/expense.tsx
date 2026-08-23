import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { CircleIconButton, IconBadge } from '@/components/design';
import { PencilIcon, ReceiptIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { useSplitStore } from '@/store/useSplitStore';
import { fmt } from '@/utils/calculator';
import { fmtDate } from '@/utils/date';
import { mediumHaptic, selectionHaptic, lightHaptic } from '@/utils/haptics';

export default function ExpenseScreen() {
  const { tripId, showImport: showImportParam } = useLocalSearchParams<{ tripId: string; showImport?: string }>();
  const router = useRouter();
  const { startTripEntry, history, linkTabToTrip } = useSplitStore();
  const [showImport, setShowImport] = useState(showImportParam === 'true');

  const importableTabs = useMemo(
    () => history.filter((r) => !r.tripId),
    [history],
  );

  const handleUploadReceipt = () => {
    mediumHaptic();
    startTripEntry(tripId!);
    router.push('/upload');
  };

  const handleManual = () => {
    mediumHaptic();
    router.push({ pathname: '/trip/manual-entry' as any, params: { tripId: tripId! } });
  };

  const handleImport = (tabId: string) => {
    lightHaptic();
    linkTabToTrip(tabId, tripId!);
    router.back();
  };

  if (showImport) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <CircleIconButton variant="back" size={20} color={C.primary} label="Back" labelStyle={s.backText}
          onPress={() => setShowImport(false)} style={s.backRow} />
        <Text style={s.importTitle}>Pick a tab to import</Text>
        <ScrollView contentContainerStyle={s.importList}>
          {importableTabs.length === 0 ? (
            <View style={s.emptyWrap}>
              <ReceiptIcon size={40} color={C.textDim} />
              <Text style={s.emptyText}>No standalone tabs found</Text>
            </View>
          ) : (
            importableTabs.map((tab) => (
              <PressBtn
                key={tab.id}
                style={s.importCard}
                onPress={() => handleImport(tab.id)}
                activeOpacity={0.75}
              >
                <IconBadge size={38} bg={C.primaryDim}>
                  <ReceiptIcon size={20} color={C.primary} />
                </IconBadge>
                <View style={{ flex: 1 }}>
                  <Text style={s.importName} numberOfLines={1}>{tab.restaurantName || 'Receipt'}</Text>
                  {!!tab.receiptDate && (
                    <Text style={s.importMeta}>{fmtDate(tab.receiptDate) || tab.receiptDate}</Text>
                  )}
                </View>
                <Text style={s.importTotal}>{fmt(tab.total)}</Text>
              </PressBtn>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <OptionCard
          icon="camera-outline"
          title="Upload receipt"
          desc="Scan or upload a photo to auto-fill items"
          onPress={handleUploadReceipt}
        />
        <OptionCard
          iconNode={<PencilIcon color={C.primary} size={22} />}
          title="Enter manually"
          desc="Type in items and amounts yourself"
          onPress={handleManual}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionCard({
  icon, iconNode, title, desc, onPress,
}: {
  icon?: string; iconNode?: React.ReactNode; title: string; desc: string; onPress: () => void;
}) {
  return (
    <PressBtn style={s.optionCard} onPress={onPress} activeOpacity={0.8}>
      <IconBadge size={48} bg={C.primaryDim}>
        {iconNode ?? <MaterialCommunityIcons name={icon as any} size={26} color={C.primary} />}
      </IconBadge>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionDesc}>{desc}</Text>
      </View>
    </PressBtn>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 12, paddingTop: 20 },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.card, borderRadius: 14,
    padding: 16,
  },
  optionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: C.text },
  optionDesc: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.textSub, marginTop: 2 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  backText: { fontFamily: 'Poppins_500Medium', fontSize: 15, color: C.primary },
  importTitle: { fontFamily: 'Poppins_900Black', fontSize: 22, color: C.text, paddingHorizontal: 16, paddingBottom: 12 },
  importList: { padding: 16, gap: 10 },

  importCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 12, padding: 12,
  },
  importName: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: C.text },
  importMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.textSub, marginTop: 1 },
  importTotal: { fontFamily: 'Poppins_900Black', fontSize: 18, color: C.text },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.textSub },
});
