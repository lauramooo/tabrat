import { Platform } from 'react-native';

// The scanned receipt photo kept with a bill so it can be referenced later. The image manipulator
// writes to the cache directory, which iOS can purge at any time, so native copies it into
// Documents/receipts. On web there's no durable file store, so the photo lives as a data URI.
//
// iOS changes the app container's absolute path on every update, so a stored file:// URI goes
// stale — resolveReceiptUri rebuilds it from the filename against the current Documents path.

const DIR = 'receipts';

// Native-only module, required lazily so web never loads it (same pattern as DateTimePicker).
const fs = () => require('expo-file-system') as typeof import('expo-file-system');

export function saveReceiptImage(base64: string): string {
  if (Platform.OS === 'web') return `data:image/jpeg;base64,${base64}`;
  const { Directory, File, Paths } = fs();
  const dir = new Directory(Paths.document, DIR);
  dir.create({ idempotent: true });
  const file = new File(dir, `${Date.now().toString(36)}.jpg`);
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

export function resolveReceiptUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (Platform.OS === 'web' || !uri.includes(`/${DIR}/`)) return uri;
  const { File, Paths } = fs();
  return new File(Paths.document, DIR, uri.split('/').pop()!).uri;
}

export async function readReceiptBase64(uri: string): Promise<string | null> {
  if (uri.startsWith('data:')) return uri.split(',')[1] ?? null;
  if (Platform.OS === 'web') return null;
  const { File } = fs();
  const file = new File(resolveReceiptUri(uri)!);
  return file.exists ? file.base64() : null;
}

export function deleteReceiptImage(uri: string | null | undefined) {
  if (!uri || Platform.OS === 'web' || !uri.includes(`/${DIR}/`)) return;
  try {
    const { File } = fs();
    const file = new File(resolveReceiptUri(uri)!);
    if (file.exists) file.delete();
  } catch {}
}
