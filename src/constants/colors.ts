const BACKGROUND = '#F8F1E8';
const LAYER = '#EDE6DD';

export const C = {
  bg: BACKGROUND,
  card: LAYER,
  border: '#E8E4DC',
  primary: '#000000',
  primaryDim: LAYER,
  yellow: LAYER,
  text: '#000000',
  textSub: '#606060',
  textDim: '#9A9A9A',
  success: '#57613B',
  successBg: '#B9C886',
  error: '#F2786B',
  errorFg: '#6D2A23',
  white: '#FFFFFF',
  billBg: '#B9C886',
  billFg: '#57613B',
  tripBg: '#F5B8DA',
  tripFg: '#90677E',
  homeBg: '#B6CAEE',
  homeFg: '#4F596B',
  // Swipe-action pill backgrounds — same colors as the bill/home badges (billBg/homeBg), paired
  // with the matching dark billFg/homeFg text at each call site (see ActionPill usages).
  pillPaid: '#B9C886',
  pillInfo: '#B6CAEE',
} as const;

export const PERSON_PALETTE = [
  { bg: '#D0E4FF', text: '#1A3D8B' }, // blue
  { bg: '#D0F0E4', text: '#1A6B4A' }, // green
  { bg: '#FFD0E8', text: '#8B1A5B' }, // pink
  { bg: '#F5C09A', text: '#7A4A28' }, // peach
  { bg: '#C8B8E8', text: '#725D9D' }, // purple
  { bg: '#A9D6C5', text: '#48826C' }, // teal
] as const;

// Friend/person selection chips — light fills reusing the same pink/green/blue as trip/bill/home badges, plus peach/purple.
export const CHIP_PALETTE = [C.tripBg, C.billBg, C.homeBg, '#F5C09A', '#C8B8E8'] as const;

// Person avatar badges (e.g. split summary) — same light pink/green/blue + dark fg pairing as trip/bill/home badges, plus peach/purple.
export const AVATAR_PALETTE = [
  { bg: C.tripBg, text: C.tripFg },
  { bg: C.billBg, text: C.billFg },
  { bg: C.homeBg, text: C.homeFg },
  { bg: '#F5C09A', text: '#7A4A28' },
  { bg: '#C8B8E8', text: '#725D9D' },
] as const;
