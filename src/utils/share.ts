import { Platform, Share } from 'react-native';

// Native: hands off to the OS share sheet, which is its own confirmation. Web: no share sheet
// exists, so copy to the clipboard instead — the true return value tells the caller to show its
// own "Copied!" feedback, which the native path doesn't need.
export async function shareText(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(message);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await Share.share({ message });
  } catch {}
  return false;
}
