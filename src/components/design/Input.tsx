import { forwardRef, useState } from 'react';
import { StyleProp, TextInput, TextInputProps, TextStyle } from 'react-native';
import { C } from '@/constants/colors';
import { InputMetrics } from '@/constants/spacing';

const BORDER_WIDTH = 1.5;

export const Input = forwardRef<TextInput, TextInputProps & { style?: StyleProp<TextStyle> }>(
  function Input({ style, onFocus, onBlur, placeholderTextColor, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? C.textDim}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
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
            fontFamily: 'Poppins_400Regular',
            fontSize: 15,
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
