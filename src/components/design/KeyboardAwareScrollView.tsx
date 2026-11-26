import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentType } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewProps } from 'react-native';
import { keyboardOverlap } from '@/utils/keyboard';

const MARGIN = 16;
// Room to keep clear under a search field whose suggestions list opens below it.
export const DROPDOWN_REVEAL = 240;

type Props = ScrollViewProps & {
  /** Extra space to keep visible under the focused field (e.g. DROPDOWN_REVEAL for a search with suggestions). */
  revealBelow?: number;
  /** A ScrollView-compatible container to render instead (e.g. the draggable list's NestableScrollContainer). */
  component?: ComponentType<any>;
};

// The one scroll container for anything with text fields — full screens and pop-up cards alike.
// Whenever a field inside it is focused while the keyboard is up (including tapping from one field
// to the next), it scrolls just enough that the field, plus `revealBelow` points under it, sits
// above the keyboard, and pads its content by however much the keyboard overlaps it so even the
// last field can scroll that far. Replaces the per-screen mix of KeyboardAvoidingView and
// automaticallyAdjustKeyboardInsets, which each covered some layouts and not others.
export const KeyboardAwareScrollView = forwardRef<ScrollView, Props>(
  function KeyboardAwareScrollView({ revealBelow = 0, component: Container = ScrollView as ComponentType<any>, children, style, contentContainerStyle, ...props }, ref) {
    const scrollRef = useRef<ScrollView>(null);
    useImperativeHandle(ref, () => scrollRef.current as ScrollView);
    const contentRef = useRef<View>(null);
    const keyboardTop = useRef<number | null>(null);
    const [bottomPad, setBottomPad] = useState(0);

    useEffect(() => {
      let lastFocused: unknown = null;

      const reveal = () => {
        const input = TextInput.State.currentlyFocusedInput?.() as any;
        const scroll = scrollRef.current as any;
        const content = contentRef.current as any;
        lastFocused = input;
        if (!input || !scroll?.measureInWindow || !content || keyboardTop.current == null) return;
        scroll.measureInWindow((_sx: number, sy: number, _sw: number, sh: number) => {
          const kbTop = keyboardTop.current;
          if (kbTop == null) return;
          setBottomPad(Math.max(0, sy + sh - kbTop));
          // measureLayout fails when the focused field isn't inside this scroll view (e.g. it's in
          // a pop-up over this screen) — then there's nothing for this one to do.
          input.measureLayout(content, (_x: number, y: number, _w: number, h: number) => {
            // The content view starts at the top of the scrolled content, so how far it sits above
            // the scroll view's top edge is the current scroll offset.
            content.measureInWindow((_cx: number, cy: number) => {
              const offset = sy - cy;
              const visibleH = Math.min(sh, kbTop - sy) - MARGIN;
              if (visibleH <= 0) return;
              let target = offset;
              if (y + h + revealBelow > offset + visibleH) target = Math.min(y + h + revealBelow - visibleH, y - MARGIN);
              else if (y < offset + MARGIN) target = y - MARGIN;
              if (Math.abs(target - offset) < 1) return;
              // Let the bottom padding render first so a target past the old content end is reachable.
              setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: true }), 30);
            });
          }, () => {});
        });
      };

      const showEvt = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
      const show = Keyboard.addListener(showEvt, (e) => {
        const overlap = keyboardOverlap(e);
        keyboardTop.current = overlap > 0 ? e.endCoordinates.screenY : null;
        if (overlap === 0) { setBottomPad(0); return; }
        // Wait out the keyboard (and any pop-up lifting with it) before measuring.
        setTimeout(reveal, (e.duration || 250) + 20);
      });
      const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
        keyboardTop.current = null;
        setBottomPad(0);
      });
      // Moving focus between fields doesn't always re-fire a keyboard event, so also notice it here.
      const poll = setInterval(() => {
        if (keyboardTop.current == null) return;
        const current = TextInput.State.currentlyFocusedInput?.();
        if (current && current !== lastFocused) reveal();
      }, 200);
      return () => { show.remove(); hide.remove(); clearInterval(poll); };
    }, [revealBelow]);

    return (
      <Container
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        style={[{ flexShrink: 1 }, style]}
        {...props}
        // The caller's content style (padding, gap, flexGrow…) goes on the measured inner View so
        // it lays out exactly as before; only flexGrow is mirrored so "fill the screen" layouts still fill.
        contentContainerStyle={{ flexGrow: StyleSheet.flatten(contentContainerStyle)?.flexGrow ?? 0 }}
      >
        <View ref={contentRef} collapsable={false} style={contentContainerStyle}>
          {children}
          {/* Inside the content, not after it: a sibling spacer would sit above anything that
              overflows the content's bottom edge — like an inline search dropdown — and swallow
              its taps. pointerEvents none so it never takes a touch either way. */}
          {bottomPad > 0 && <View style={{ height: bottomPad }} pointerEvents="none" />}
        </View>
      </Container>
    );
  },
);
