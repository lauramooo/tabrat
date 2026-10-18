import { TextInput as RNTextInput, type TextInputProps } from 'react-native';
import { Text as PaperText } from 'react-native-paper';

// How far text may grow with the system text-size setting. Layouts are fixed-height pills, tab
// labels and rows sized for default text — uncapped, a larger setting (common on iPad, where this
// iPhone-only app runs in a small window) wrapped "Account" in the tab bar and truncated row
// subtitles. A little growth is still allowed so the setting isn't ignored outright.
export const MAX_FONT_SCALE = 1.15;

// Drop-in replacements for Paper's Text and React Native's TextInput with the cap applied —
// import these instead of the library versions. (React 19 passes `ref` through as a normal prop.)
export const Text = function Text(props: any) {
  return <PaperText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
} as unknown as typeof PaperText;

export const TextInput = function TextInput(props: TextInputProps) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
} as unknown as typeof RNTextInput;
export type TextInput = RNTextInput;
