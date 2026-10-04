export const Type = {
  // The big brand wordmark treatment ("TAB RAT") shared by the Welcome and sign-in screens —
  // distinct from `display`, which is an in-app screen header (e.g. Feed's "Feed" title).
  hero:         { fontFamily: 'Poppins_900Black',    fontSize: 40 },
  display:      { fontFamily: 'Poppins_900Black',    fontSize: 36 },
  h1:           { fontFamily: 'Poppins_900Black',    fontSize: 27 },
  h2:           { fontFamily: 'Poppins_900Black',    fontSize: 25 },
  // A small black heading weight between h2 and body sizes — e.g. the Welcome screen's
  // "split / bills / trips / home / expenses" word stack.
  h3:           { fontFamily: 'Poppins_900Black',    fontSize: 20 },
  emptyTitle:   { fontFamily: 'Poppins_900Black',    fontSize: 32 },
  sectionLabel: { fontFamily: 'Poppins_700Bold',     fontSize: 14 },
  fieldLabel:   { fontFamily: 'Poppins_600SemiBold', fontSize: 13, letterSpacing: 0.8 },
  cardTitle:    { fontFamily: 'Poppins_700Bold',     fontSize: 14 },
  cardDesc:     { fontFamily: 'Poppins_400Regular',  fontSize: 14 },
  // The 500-weight equivalent of `body`/`bodySmall` — used for list-row names, dropdown text,
  // form values, and similar mid-weight labels. Added to absorb the ~40 call sites that were
  // duplicating 'Poppins_500Medium' + a hand-picked size (mostly 13-15px) with no shared token.
  labelMedium:  { fontFamily: 'Poppins_500Medium',   fontSize: 16 },
  body:         { fontFamily: 'Poppins_400Regular',  fontSize: 17 },
  bodySmall:    { fontFamily: 'Poppins_400Regular',  fontSize: 16 },
  button:       { fontFamily: 'Poppins_600SemiBold', fontSize: 17 },
  buttonLg:     { fontFamily: 'Poppins_600SemiBold', fontSize: 18 },
  pillLabel:    { fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  // Smallest reusable role — tab bar labels, dividers ("or continue with"), inline captions.
  caption:      { fontFamily: 'Poppins_500Medium',   fontSize: 12 },
} as const;
