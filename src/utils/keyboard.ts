import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from 'react-native';

// How much of the app window the on-screen keyboard currently covers, in points (0 when hidden).
// Measured from the keyboard's top edge rather than its reported height so it stays right when the
// app runs in a window smaller than the screen (an iPhone-only app on iPad).
export function keyboardOverlap(e: KeyboardEvent): number {
  return Math.max(0, Dimensions.get('window').height - e.endCoordinates.screenY);
}

// iOS only: Android resizes the window for the keyboard on its own, so lifting content there too
// would double the gap.
export function useKeyboardOverlap(): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const update = (e: KeyboardEvent, next: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(e.duration || 250, LayoutAnimation.Types.keyboard, LayoutAnimation.Properties.opacity));
      setOverlap(next);
    };
    const show = Keyboard.addListener('keyboardWillChangeFrame', (e) => update(e, keyboardOverlap(e)));
    const hide = Keyboard.addListener('keyboardWillHide', (e) => update(e, 0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return overlap;
}
