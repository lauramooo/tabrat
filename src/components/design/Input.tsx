import { forwardRef, useState } from 'react';
import { StyleProp, TextInput, TextInputProps, TextStyle } from 'react-native';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { InputMetrics } from '@/constants/spacing';
import { applyTextShortcuts } from '@/utils/text';

const BORDER_WIDTH = 1.5;

export const Input = forwardRef<TextInput, TextInputProps & { style?: StyleProp<TextStyle> }>(
  function Input({ style, onFocus, onBlur, onChangeText, placeholderTextColor, returnKeyType, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? C.textDim}
        // Every text field gets a clear "done" key on the keyboard by default rather than each
        // screen having to remember to set it (and some not) — pass returnKeyType explicitly only
        // when a field genuinely needs something else (e.g. "next" to chain to another field).
        returnKeyType={returnKeyType ?? 'done'}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        onChangeText={onChangeText ? (text) => onChangeText(applyTextShortcuts(text)) : undefined}
        style={[
          {
            backgroundColor: C.card,
            borderRadius: InputMetrics.radius,
            height: InputMetrics.height,
            minHeight: InputMetrics.height,
            flexShrink: 0,
            paddingHorizontal: 14,
            textAlignVertical: 'center',
            color: C.text,
            ...Type.bodySmall,
            borderWidth: BORDER_WIDTH,
            borderColor: focused ? C.text : 'transparent',
          },
          style,
        ]}
        {...props}
      />
    );
  },
);
