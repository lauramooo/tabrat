import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressBtn } from '@/components/PressBtn';
import { CameraIcon, PencilIcon, ReceiptShapeIcon, ScanIcon } from '@/components/FigmaIcons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS, Alert, Image, PanResponder, Platform,
  StyleSheet, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Button, CircleIconButton } from '@/components/design';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { FlowSteps } from '@/components/FlowSteps';
import { useSplitStore } from '@/store/useSplitStore';
import { getApiKey, getStorageItem, PROFILE_USES_SHARED_KEY } from './settings';
import { supabase } from '@/lib/supabase';
import { parseReceipt, parseReceiptViaProxy } from '@/utils/receiptParser';
import { errorMessage } from '@/utils/errors';
import { lightHaptic, mediumHaptic, errorHaptic } from '@/utils/haptics';
const MIN_DIM = 60;
// L-bracket handle dimensions — positioned INSIDE the crop box, never extending outside
const B = 28;   // bracket width/height
const BI = 4;   // inset from crop box corner

function computeBounds(cw: number, ch: number, iw: number, ih: number) {
  const ia = iw / ih;
  const ca = cw / ch;
  if (ia > ca) {
    const dh = cw / ia;
    return { displayW: cw, displayH: dh, offsetX: 0, offsetY: (ch - dh) / 2 };
  }
  const dw = ch * ia;
  return { displayW: dw, displayH: ch, offsetX: (cw - dw) / 2, offsetY: 0 };
}

async function uriToBase64Web(uri: string): Promise<string | null> {
  try {
    if (uri.startsWith('data:')) return uri.split(',')[1] ?? null;
    const blob = await (await fetch(uri)).blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onloadend = () => res((r.result as string).split(',')[1] ?? null);
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

export default function UploadScreen() {
  const router = useRouter();
  const { imageUri: storeUri, imageBase64: storeB64, setImage, setReceiptData } = useSplitStore();

  const [uri, setUri] = useState<string | null>(storeUri);
  const [base64, setBase64] = useState<string | null>(storeB64);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Crop state
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, w: 100, h: 100 });
  const [cropReady, setCropReady] = useState(false);
  // Only true once the user has actually dragged a handle — until then the crop box is just the
  // full-frame default, and scanning should use the original image untouched rather than re-derive
  // a "full" crop through scale math that can shave pixels off the edges from rounding.
  const [userAdjustedCrop, setUserAdjustedCrop] = useState(false);

  const bounds = (containerSize.w > 0 && containerSize.h > 0 && imgSize.w > 1)
    ? computeBounds(containerSize.w, containerSize.h, imgSize.w, imgSize.h)
    : { displayW: 0, displayH: 0, offsetX: 0, offsetY: 0 };

  const cropBoxRef = useRef(cropBox);
  cropBoxRef.current = cropBox;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const imgSizeRef = useRef(imgSize);
  imgSizeRef.current = imgSize;

  // Get natural image size — web only, since <Image onLoad> below doesn't report `source` there.
  // On native this used to also run and could occasionally resolve with different dimensions than
  // onLoad (a second, separate native size-reporting path), racing to set imgSize with whichever
  // finished last; since the crop math depends on imgSize exactly matching what's on screen, that
  // inconsistency alone could produce a wrong crop even independent of the orientation fix above.
  useEffect(() => {
    if (!uri) { setImgSize({ w: 1, h: 1 }); setCropReady(false); return; }
    if (Platform.OS !== 'web') return;
    Image.getSize(
      uri,
      (w, h) => { if (w > 0 && h > 0) setImgSize(p => p.w > 1 ? p : { w, h }); },
      () => {},
    );
  }, [uri]);

  // Init crop box to cover the full displayed image (no inset) — only before the user has taken
  // control of it. Once they've adjusted it manually, this must never overwrite their box again,
  // even if a later layout pass (e.g. during scanning) recomputes containerSize/imgSize.
  useEffect(() => {
    if (userAdjustedCrop) return;
    const { displayW, displayH, offsetX, offsetY } = computeBounds(
      containerSize.w, containerSize.h, imgSize.w, imgSize.h,
    );
    if (displayW > 0 && displayH > 0) {
      setCropBox({ x: offsetX, y: offsetY, w: displayW, h: displayH });
      setCropReady(true);
    }
  }, [containerSize.w, containerSize.h, imgSize.w, imgSize.h, userAdjustedCrop]);

  // PanResponders created once; live values always from refs
  const pans = useMemo(() => {
    const make = (corner: 'TL' | 'TR' | 'BL' | 'BR') => {
      let start = { x: 0, y: 0, w: 0, h: 0 };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { start = { ...cropBoxRef.current }; setUserAdjustedCrop(true); },
        onPanResponderMove: (_, { dx, dy }) => {
          const { offsetX: ox, offsetY: oy, displayW: dw, displayH: dh } = boundsRef.current;
          const { x, y, w, h } = start;
          switch (corner) {
            case 'TL': {
              const nx = Math.max(ox, Math.min(x + dx, x + w - MIN_DIM));
              const ny = Math.max(oy, Math.min(y + dy, y + h - MIN_DIM));
              setCropBox({ x: nx, y: ny, w: w + (x - nx), h: h + (y - ny) });
              break;
            }
            case 'TR': {
              const ny = Math.max(oy, Math.min(y + dy, y + h - MIN_DIM));
              setCropBox({ x, y: ny, w: Math.max(MIN_DIM, Math.min(w + dx, ox + dw - x)), h: h + (y - ny) });
              break;
            }
            case 'BL': {
              const nx = Math.max(ox, Math.min(x + dx, x + w - MIN_DIM));
              setCropBox({ x: nx, y, w: w + (x - nx), h: Math.max(MIN_DIM, Math.min(h + dy, oy + dh - y)) });
              break;
            }
            case 'BR': {
              setCropBox({ x, y, w: Math.max(MIN_DIM, Math.min(w + dx, ox + dw - x)), h: Math.max(MIN_DIM, Math.min(h + dy, oy + dh - y)) });
              break;
            }
          }
        },
      });
    };
    return { TL: make('TL'), TR: make('TR'), BL: make('BL'), BR: make('BR') };
  }, []);

  // L-bracket handles positioned INSIDE the crop box — no overflow:hidden clipping
  const brackets = [
    { key: 'TL', pan: pans.TL, top: cropBox.y + BI,              left: cropBox.x + BI,              bTop: 4, bLeft: 4, bRight: 0, bBottom: 0 },
    { key: 'TR', pan: pans.TR, top: cropBox.y + BI,              left: cropBox.x + cropBox.w - BI - B, bTop: 4, bRight: 4, bLeft: 0, bBottom: 0 },
    { key: 'BL', pan: pans.BL, top: cropBox.y + cropBox.h - BI - B, left: cropBox.x + BI,              bBottom: 4, bLeft: 4, bTop: 0, bRight: 0 },
    { key: 'BR', pan: pans.BR, top: cropBox.y + cropBox.h - BI - B, left: cropBox.x + cropBox.w - BI - B, bBottom: 4, bRight: 4, bTop: 0, bLeft: 0 },
  ];

  const handleManualEntry = () => { lightHaptic(); router.replace('/review'); };

  const clearImage = () => {
    lightHaptic();
    setUri(null); setBase64(null); setError(null);
    setImgSize({ w: 1, h: 1 }); setCropReady(false); setUserAdjustedCrop(false);
  };

  const pickImage = async (fromCamera: boolean) => {
    lightHaptic();
    setError(null);

    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setError('Camera access is required to take a photo. Please allow it in Settings.');
        return;
      }
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUri(asset.uri);
      setImgSize({ w: 1, h: 1 });
      setCropReady(false);
      setUserAdjustedCrop(false);
      let b64 = asset.base64 ?? null;
      if (!b64 && Platform.OS === 'web') b64 = await uriToBase64Web(asset.uri);
      setBase64(b64);
    }
  };

  const handleImport = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) pickImage(true);
          else if (idx === 2) pickImage(false);
        },
      );
    } else if (Platform.OS === 'android') {
      Alert.alert('Import Receipt', undefined, [
        { text: 'Take Photo', onPress: () => pickImage(true) },
        { text: 'Choose from Library', onPress: () => pickImage(false) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      pickImage(false);
    }
  };

  const handleScan = async () => {
    if (!uri || !base64) { setError('Please select an image first.'); return; }
    setError(null);
    mediumHaptic();
    setLoading(true);

    try {
      let scanUri = uri;
      let scanB64 = base64;

      if (cropReady && userAdjustedCrop) {
        const { offsetX: ox, offsetY: oy, displayW: dw, displayH: dh } = boundsRef.current;
        if (dw > 0 && dh > 0) {
          // <Image onLoad> can report a downscaled size RN decoded for on-screen display (e.g.
          // 1920x2560) rather than the photo's true full resolution (e.g. 3024x4032) — but that's
          // exactly the space the crop box was drawn in, so it's fine for POSITIONING the box.
          // The actual crop must be computed against the manipulator's own view of the file, or
          // the resulting rectangle comes out scaled down and anchored toward the top-left corner
          // of the real image, silently losing whatever's further right/down.
          const probe = await ImageManipulator.manipulate(uri).renderAsync();
          const iw = probe.width;
          const ih = probe.height;
          const scaleX = iw / dw;
          const scaleY = ih / dh;
          const originX = Math.max(0, Math.round((cropBox.x - ox) * scaleX));
          const originY = Math.max(0, Math.round((cropBox.y - oy) * scaleY));
          const cropW = Math.max(1, Math.min(iw - originX, Math.round(cropBox.w * scaleX)));
          const cropH = Math.max(1, Math.min(ih - originY, Math.round(cropBox.h * scaleY)));

          const ref = await ImageManipulator.manipulate(uri)
            .crop({ originX, originY, width: cropW, height: cropH })
            .renderAsync();
          const result = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG, base64: true });
          scanUri = result.uri;
          scanB64 = result.base64 ?? base64;
        }
      }

      const usesSharedKey = (await getStorageItem(PROFILE_USES_SHARED_KEY)) === '1';
      let data;
      if (usesSharedKey) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { errorHaptic(); setLoading(false); return; }
        data = await parseReceiptViaProxy(scanB64, process.env.EXPO_PUBLIC_SUPABASE_URL!, session.access_token);
      } else {
        const apiKey = await getApiKey();
        if (!apiKey) { errorHaptic(); setLoading(false); router.push('/settings'); return; }
        data = await parseReceipt(scanB64, apiKey);
      }
      if (!data.items?.length) {
        errorHaptic();
        setError('Could not find any items on this receipt. Try a clearer photo, or enter items manually.');
        setLoading(false);
        return;
      }
      setImage(scanUri, scanB64);
      setReceiptData(data);
      router.replace('/review');
    } catch (e: unknown) {
      errorHaptic();
      setError(errorMessage(e, 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{
        headerBackTitle: '', headerTitleAlign: 'center', title: 'Upload',
        headerTransparent: false, headerStyle: { backgroundColor: C.bg },
        // iOS's edge-swipe-back gesture listens on the left edge of the screen, which is exactly
        // where the crop box's left handle lives — disable it while a photo (and its crop handles)
        // is showing so dragging that handle doesn't also trigger a navigation swipe. The header
        // back button still works normally either way.
        gestureEnabled: !uri,
      }} />
      <FlowSteps active={-1} />

      <View style={styles.container}>
        {/* -- Main area: empty tap zone or image with crop -- */}
        {uri ? (
          <View style={styles.imageArea}>
            <View style={styles.imageGroup}>
              <View
                style={styles.imageWrapper}
                onLayout={e => {
                  const { width, height } = e.nativeEvent.layout;
                  setContainerSize({ w: width, h: height });
                }}
              >
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                  onLoad={e => {
                    const src = (e.nativeEvent as Record<string, any>)?.source;
                    if (src?.width && src?.height) {
                      setImgSize({ w: src.width as number, h: src.height as number });
                    }
                  }}
                />
                {cropReady && (
                  <>
                    <View pointerEvents="none" style={[styles.shade, { top: 0, left: 0, right: 0, height: cropBox.y }]} />
                    <View pointerEvents="none" style={[styles.shade, { top: cropBox.y + cropBox.h, left: 0, right: 0, bottom: 0 }]} />
                    <View pointerEvents="none" style={[styles.shade, { top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.h }]} />
                    <View pointerEvents="none" style={[styles.shade, { top: cropBox.y, left: cropBox.x + cropBox.w, right: 0, height: cropBox.h }]} />
                    <View pointerEvents="none" style={[styles.cropBorder, { top: cropBox.y, left: cropBox.x, width: cropBox.w, height: cropBox.h }]} />
                    {brackets.map(({ key, pan, top, left, bTop, bRight, bBottom, bLeft }) => (
                      <View key={key} {...pan.panHandlers} style={[styles.bracket, { top, left, borderTopWidth: bTop, borderRightWidth: bRight, borderBottomWidth: bBottom, borderLeftWidth: bLeft }]} />
                    ))}
                  </>
                )}
              </View>
              <CircleIconButton variant="close" size={22} color={C.text} onPress={clearImage} style={styles.imageClearBtn} />
            </View>
          </View>
        ) : (
          <View style={styles.emptyZone}>
            <PressBtn onPress={handleImport} activeOpacity={0.7} noShadow style={styles.receiptShapeWrap}>
              <ReceiptShapeIcon fillColor={C.card} size={320} />
              <View style={styles.receiptContent}>
                <CameraIcon color={C.text} size={42} />
                <Text style={styles.placeholderText}>Tap to import</Text>
              </View>
            </PressBtn>
            <Text style={styles.scanHint}>Flat, well-lit, and fully in frame scans best</Text>
          </View>
        )}

        {error ? <Text variant="bodySmall" style={styles.errorText}>{error}</Text> : null}

        {/* -- Unified footer: Enter Manually + Import (?Scan) -- */}
        <View style={styles.btnRow}>
          <Button
            variant="secondary"
            size="big"
            label="Enter manually"
            icon={<PencilIcon color={C.text} size={16} />}
            onPress={handleManualEntry}
            style={{ flex: 1 }}
          />
          <Button
            variant="primary"
            size="big"
            label={loading ? 'Scanning...' : 'Scan receipt'}
            icon={<ScanIcon color={C.text} size={18} />}
            onPress={uri ? handleScan : undefined}
            disabled={!uri || loading}
            style={{ flex: 1 }}
          />
        </View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 16, gap: 12 },

  imageArea: { flex: 1, alignItems: 'center' },
  imageGroup: { flex: 1, flexDirection: 'row', width: '85%', gap: 10 },
  imageWrapper: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  imageClearBtn: { alignSelf: 'flex-start' },

  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  cropBorder: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)' },

  // L-bracket: only 2 borders set per corner, entirely inside the crop box
  bracket: {
    position: 'absolute',
    width: B,
    height: B,
    borderColor: '#FFFFFF',
    borderRadius: 2,
  },

  emptyZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  receiptShapeWrap: { alignItems: 'center', justifyContent: 'center' },
  receiptContent: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  placeholderText: {
    ...Type.pillLabel,
    color: C.text, textAlign: 'center',
    lineHeight: 14,
  },
  scanHint: { ...Type.cardDesc, color: C.textDim, textAlign: 'center', marginTop: 12 },

  btnRow: { flexDirection: 'row', gap: 10 },
  errorText: { color: C.error, textAlign: 'center', paddingHorizontal: 8 },

});
