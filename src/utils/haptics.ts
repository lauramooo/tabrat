import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const selectionHaptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync();
};

export const lightHaptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const mediumHaptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const successHaptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const errorHaptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
