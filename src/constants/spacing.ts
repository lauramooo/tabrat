export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const;

export const Radius = {
  sm: 10, md: 12, lg: 14, xl: 20, pill: 100,
} as const;

export const Badge = {
  size: 36, radius: 18, avatarSize: 30, avatarRadius: 15,
} as const;

// Canonical size for every input-like control (text fields, amount fields, date pickers) —
// same rectangle, same rounded corners, same height everywhere.
export const InputMetrics = {
  height: 46, radius: Radius.sm,
} as const;
