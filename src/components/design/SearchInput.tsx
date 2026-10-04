import { forwardRef, useState } from 'react';
import { StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { SearchIcon } from '@/components/FigmaIcons';
import { C } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { InputMetrics } from '@/constants/spacing';

const BORDER_WIDTH = 1.5;

/**
 * The "search / search-and-add" pill used on Feed, Trips, Homes, and every friend/group picker —
 * one place for the black focus stroke every other Input gets, since this used to be a bare
 * TextInput with no focus affordance at all, duplicated (and un-styled) in six-plus screens.
 * `trailing` is caller-supplied (a clear "X", a "+" add button, or a dropdown chevron) since that
 * part genuinely varies by screen; only the box/icon/input chrome is shared.
 */
export const SearchInput = forwardRef<TextInput, TextInputProps & {
  style?: StyleProp<ViewStyle>;
  trailing?: React.ReactNode;
}>(function SearchInput({ style, trailing, onFocus, onBlur, placeholderTextColor, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        {
          flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
          borderRadius: InputMetrics.radius, height: InputMetrics.height,
          borderWidth: BORDER_WIDTH, borderColor: focused ? C.text : 'transparent',
          paddingLeft: 14, paddingRight: 8,
        },
        style,
      ]}
    >
      <SearchIcon color={C.text} size={15} />
      <TextInput
        ref={ref}
        style={[
          {
            flex: 1, minWidth: 0, ...Type.bodySmall,
            color: C.text, height: '100%', textAlignVertical: 'center', paddingHorizontal: 10,
          },
          { outlineWidth: 0 } as any,
        ]}
        placeholderTextColor={placeholderTextColor ?? C.textDim}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        // Delayed like the dropdown-close pattern elsewhere in these screens — tapping the
        // trailing "+" blurs this field a beat before its own onPress fires, so clearing the
        // border immediately made it flash black-to-transparent right as the add happens.
        onBlur={(e) => { setTimeout(() => setFocused(false), 150); onBlur?.(e); }}
        {...props}
      />
      {trailing}
    </View>
  );
});
