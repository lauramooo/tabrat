import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView, SectionList,
  StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { PressBtn } from '@/components/PressBtn';
import { BugIcon, CameraIcon, ChevronUpCircleIcon, LightbulbIcon, PhotoIcon, PlusIcon, XMarkIcon } from '@/components/FigmaIcons';
import { Button, Card, CenteredModal, FieldLabel, IconBadge, Input, SectionLabel } from '@/components/design';
import { AVATAR_PALETTE, C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { fetchFeedbackItems, setVote, submitFeedbackItem } from '@/lib/feedback';
import type { FeedbackItem, FeedbackStatus, FeedbackType } from '@/types';
import { errorMessage } from '@/utils/errors';
import { lightHaptic, mediumHaptic, selectionHaptic } from '@/utils/haptics';

const STATUS_ORDER: FeedbackStatus[] = ['in_progress', 'planned', 'under_review', 'done'];
const STATUS_LABELS: Record<FeedbackStatus, string> = {
  in_progress: 'IN PROGRESS', planned: 'PLANNED', under_review: 'UNDER REVIEW', done: 'DONE', declined: 'DECLINED',
};

// -- Submission modal ------------------------------------------------------------

function SubmitModal({ visible, initialType, onClose, onSubmitted }: {
  visible: boolean; initialType: FeedbackType; onClose: () => void; onSubmitted: (item: FeedbackItem) => void;
}) {
  const [type, setType] = useState<FeedbackType>(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setType(initialType); setTitle(''); setDescription(''); setImageUri(null); setError(null);
    }
  }, [visible, initialType]);

  const pickImage = async (source: 'library' | 'camera') => {
    // Keep the form modal hidden (see visible={... && !pickerBusy} below) for the whole picker
    // flow, not just while the sheet is open — closing the sheet alone let the form modal
    // re-present right as the OS picker also tried to present, and the OS picker lost that race
    // and never showed, leaving launchImageLibraryAsync's promise hanging forever.
    setPhotoSheetVisible(false);
    setPickerBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      let result;
      if (source === 'library') {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
      }
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
    } finally {
      setPickerBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Give it a short title.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const item = await submitFeedbackItem({ type, title, description, imageUri });
      mediumHaptic();
      onSubmitted(item);
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not submit — try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Two native Modals can't be presented at once reliably — hide this one (rather than
          leave it visible underneath) while the screenshot-source sheet or the OS image/camera
          picker is up. The form state itself lives in this component, not inside CenteredModal's
          children, so it survives that Modal briefly unmounting its content. */}
      <CenteredModal visible={visible && !photoSheetVisible && !pickerBusy} onClose={onClose} padding={20} title={<Text style={s.modalTitle}>New submission</Text>}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
          <View style={s.typeToggle}>
            <Button variant="filter" size="small" active={type === 'idea'}
              icon={<LightbulbIcon size={13} color={type === 'idea' ? C.bg : C.text} />}
              label="Idea" onPress={() => { lightHaptic(); setType('idea'); }} />
            <Button variant="filter" size="small" active={type === 'bug'}
              icon={<BugIcon size={13} color={type === 'bug' ? C.bg : C.text} />}
              label="Bug" onPress={() => { lightHaptic(); setType('bug'); }} />
          </View>

          <FieldLabel style={{ marginTop: 16 }}>TITLE</FieldLabel>
          <Input
            value={title}
            onChangeText={(v) => { setTitle(v); setError(null); }}
            placeholder={type === 'bug' ? "What's broken?" : "What's the idea?"}
            placeholderTextColor={C.textDim}
          />

          <FieldLabel style={{ marginTop: 16 }}>DESCRIPTION</FieldLabel>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder={type === 'bug' ? 'Steps to reproduce, what you expected…' : 'Any more detail that helps explain it…'}
            placeholderTextColor={C.textDim}
            multiline
            numberOfLines={4}
            returnKeyType="default"
            style={{ height: 100, textAlignVertical: 'top', paddingTop: 12, paddingBottom: 12 }}
          />

          <FieldLabel style={{ marginTop: 16 }}>SCREENSHOT</FieldLabel>
          {imageUri ? (
            <View style={s.imagePreviewWrap}>
              <Image source={{ uri: imageUri }} style={s.imagePreview} />
              <PressBtn style={s.imageRemoveBtn} onPress={() => { lightHaptic(); setImageUri(null); }} hitSlop={6}>
                <XMarkIcon size={12} color="#fff" />
              </PressBtn>
            </View>
          ) : (
            <PressBtn style={s.addScreenshotBtn} onPress={() => { selectionHaptic(); setPhotoSheetVisible(true); }} activeOpacity={0.7}>
              <PhotoIcon size={15} color={C.textSub} />
              <Text style={s.addScreenshotText}>Add a screenshot</Text>
            </PressBtn>
          )}

          {error ? <Text style={s.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={s.modalBtns}>
          <Button variant="secondary" size="small" label="Cancel" onPress={onClose} disabled={submitting} />
          <Button variant="primary" size="small" label={submitting ? 'Submitting…' : 'Submit'} onPress={handleSubmit} disabled={submitting} />
        </View>
      </CenteredModal>

      {/* Screenshot source sheet — same take/upload pattern as the profile photo picker */}
      <CenteredModal visible={photoSheetVisible} onClose={() => setPhotoSheetVisible(false)} padding={24} title={<Text style={s.modalTitle}>Add screenshot</Text>}>
        <View style={{ gap: 10 }}>
          <Card onPress={() => pickImage('camera')} pressBorderColor={AVATAR_PALETTE[0].bg}>
            <IconBadge bg={AVATAR_PALETTE[0].bg}>
              <CameraIcon size={16} color={AVATAR_PALETTE[0].text} />
            </IconBadge>
            <Text style={s.sheetRowTitle}>Take photo</Text>
          </Card>
          <Card onPress={() => pickImage('library')} pressBorderColor={AVATAR_PALETTE[1].bg}>
            <IconBadge bg={AVATAR_PALETTE[1].bg}>
              <PhotoIcon size={16} color={AVATAR_PALETTE[1].text} />
            </IconBadge>
            <Text style={s.sheetRowTitle}>Upload screenshot</Text>
          </Card>
        </View>
      </CenteredModal>
    </>
  );
}

// -- Item row ----------------------------------------------------------------

function ItemRow({ item, onToggleVote }: { item: FeedbackItem; onToggleVote: (item: FeedbackItem) => void }) {
  const isBug = item.type === 'bug';
  return (
    <Card style={s.itemCard}>
      <IconBadge bg={isBug ? C.errorFg + '18' : C.billBg} size={34}>
        {isBug ? <BugIcon size={15} color={C.error} /> : <LightbulbIcon size={15} color={C.billFg} />}
      </IconBadge>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
        {!!item.description && <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>}
        {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={s.itemThumb} />}
      </View>
      <PressBtn style={[s.voteBtn, item.myVote && s.voteBtnActive]} onPress={() => onToggleVote(item)} activeOpacity={0.7}>
        <ChevronUpCircleIcon size={16} color={item.myVote ? C.text : C.textSub} />
        <Text style={[s.voteCount, item.myVote && s.voteCountActive]}>{item.voteCount}</Text>
      </PressBtn>
    </Card>
  );
}

// -- Screen --------------------------------------------------------------------

export default function RoadmapScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | FeedbackType>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<FeedbackType>('idea');

  const load = useCallback(async () => {
    try {
      setItems(await fetchFeedbackItems());
    } catch (e) {
      console.warn('[roadmap]', errorMessage(e, String(e)));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    if (params.type === 'bug' || params.type === 'idea') {
      setModalType(params.type);
      setModalVisible(true);
    }
    // Only react to the param on first mount — re-opening the modal on every unrelated re-render
    // (e.g. after a vote toggle re-renders this screen) would be annoying, not helpful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleVote = (item: FeedbackItem) => {
    lightHaptic();
    const voted = !item.myVote;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, myVote: voted, voteCount: i.voteCount + (voted ? 1 : -1) } : i)));
    setVote(item.id, voted).catch(() => {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, myVote: item.myVote, voteCount: item.voteCount } : i)));
    });
  };

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);
  const sections = STATUS_ORDER
    .map((status) => ({ title: STATUS_LABELS[status], data: filtered.filter((i) => i.status === status) }))
    .filter((sec) => sec.data.length > 0);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Roadmap', headerTransparent: false, headerStyle: { backgroundColor: C.bg } }} />

      <View style={s.filterRow}>
        <Button variant="filter" size="small" active={filter === 'all'} label="All" onPress={() => { lightHaptic(); setFilter('all'); }} />
        <Button variant="filter" size="small" active={filter === 'idea'} label="Ideas" onPress={() => { lightHaptic(); setFilter('idea'); }} />
        <Button variant="filter" size="small" active={filter === 'bug'} label="Bugs" onPress={() => { lightHaptic(); setFilter('bug'); }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.text} /></View>
      ) : sections.length === 0 ? (
        <View style={s.empty}>
          <IconBadge size={72} bg={C.card}>
            <LightbulbIcon size={32} color={C.textSub} />
          </IconBadge>
          <Text style={s.emptyTitle}>Nothing here yet</Text>
          <Text style={s.emptyDesc}>Be the first to submit an idea or report a bug.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemRow item={item} onToggleVote={toggleVote} />}
          renderSectionHeader={({ section: { title } }) => (
            <View style={s.sectionHeader}><SectionLabel>{title}</SectionLabel></View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSub} />}
        />
      )}

      <View style={s.footer}>
        <Button
          variant="primary"
          size="big"
          icon={<PlusIcon size={18} color={C.text} />}
          label="New submission"
          onPress={() => { selectionHaptic(); setModalType(filter === 'bug' ? 'bug' : 'idea'); setModalVisible(true); }}
        />
      </View>

      <SubmitModal
        visible={modalVisible}
        initialType={modalType}
        onClose={() => setModalVisible(false)}
        onSubmitted={(item) => setItems((prev) => [item, ...prev])}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },

  listContent: { padding: 16, paddingTop: 8 },
  sectionHeader: { paddingTop: 8, paddingBottom: 8, backgroundColor: C.bg },

  itemCard: { alignItems: 'flex-start' },
  itemTitle: { ...Type.cardTitle, color: C.text },
  itemDesc: { ...Type.cardDesc, color: C.textSub },
  itemThumb: { width: '100%', height: 120, borderRadius: 10, marginTop: 6, backgroundColor: C.border },

  voteBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    width: 48, paddingVertical: 8, borderRadius: 12,
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border,
  },
  voteBtnActive: { backgroundColor: C.yellow, borderColor: C.text },
  voteCount: { ...Type.pillLabel, color: C.textSub },
  voteCountActive: { color: C.text, fontFamily: 'Poppins_700Bold' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { ...Type.emptyTitle, color: C.text },
  emptyDesc: { ...Type.cardDesc, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  footer: { padding: 16, paddingTop: 8 },

  modalTitle: { ...Type.h2, fontSize: 18, color: C.text },
  typeToggle: { flexDirection: 'row', gap: 8 },

  addScreenshotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 10, height: 46, paddingHorizontal: 14,
  },
  addScreenshotText: { ...Type.bodySmall, color: C.textSub },
  imagePreviewWrap: { position: 'relative' },
  imagePreview: { width: '100%', height: 140, borderRadius: 10, backgroundColor: C.border },
  imageRemoveBtn: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },

  sheetRowTitle: { ...Type.cardTitle, color: C.text },

  errorText: { color: C.error, ...Type.cardDesc, marginTop: 12 },

  modalBtns: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 16 },
});
