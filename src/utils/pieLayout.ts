// Lays out donut-chart segments so every category gets a distinct, non-overlapping slot on
// the ring. Positioning a segment purely by its raw cumulative value (offset += rawLen) falls
// apart when categories differ by orders of magnitude: a handful of near-zero categories all
// advance the cumulative offset by essentially nothing, so they end up stacked on top of each
// other at (visually) the same angular position — only the last one painted is ever visible,
// even though each individually renders at some nonzero length. Advancing the offset by each
// segment's own rendered length instead (which already carries the small minimum floor) gives
// every category its own slot by construction, so nothing can hide behind a neighbor.
export function layoutPieSegments<T extends { value: number }>(
  data: T[],
  circumference: number,
  gap: number,
  minSweep: number,
): (T & { len: number; offset: number })[] {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) return [];
  const positive = data.filter((d) => d.value > 0);
  const n = positive.length;
  if (n === 0) return [];
  // Raw lengths are still computed against the full circumference, so anything comfortably
  // above the minimum renders at its true proportional size — the floor only ever kicks in
  // for shares too small to draw at all.
  const rawLens = positive.map((d) => (d.value / total) * circumference);
  const lens = rawLens.map((r) => Math.max(minSweep, r - gap));
  // If floored minimums would collectively overrun the circle (many tiny categories), scale
  // them down together rather than let segments wrap past 360° and overlap from the far side.
  const totalLen = lens.reduce((sum, l) => sum + l, 0) + n * gap;
  const scale = totalLen > circumference ? circumference / totalLen : 1;
  let cum = 0;
  return positive.map((d, i) => {
    const len = lens[i] * scale;
    const segGap = gap * scale;
    const offset = -(cum + segGap / 2);
    cum += len + segGap;
    return { ...d, len, offset };
  });
}

function polarPoint(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

// Builds an SVG path for one donut segment (an annular sector) with a small rounded corner at
// each of its 4 corners, without changing the segment's true angular sweep — the corner radius
// only softens the edge, it never eats into how much of the ring the segment visually covers.
// Corners are rounded with quadratic Béziers using the *original* sharp corner as the control
// point, which always bulges the curve toward that corner — unlike an arc-based fillet, there's
// no sweep-direction flag to get backwards.
export function roundedSegmentPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number,
  cornerR: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0 || outerR <= innerR) return '';

  const outerStartCorner = polarPoint(cx, cy, outerR, startAngle);
  const outerEndCorner = polarPoint(cx, cy, outerR, endAngle);
  const innerEndCorner = polarPoint(cx, cy, innerR, endAngle);
  const innerStartCorner = polarPoint(cx, cy, innerR, startAngle);

  const maxByThickness = (outerR - innerR) / 2;
  const maxBySweep = (sweep * Math.min(innerR, outerR)) / 2;
  const r = Math.max(0, Math.min(cornerR, maxByThickness, maxBySweep));

  if (r < 0.5) {
    const large = sweep > Math.PI ? 1 : 0;
    return [
      `M ${outerStartCorner.x} ${outerStartCorner.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${outerEndCorner.x} ${outerEndCorner.y}`,
      `L ${innerEndCorner.x} ${innerEndCorner.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${innerStartCorner.x} ${innerStartCorner.y}`,
      'Z',
    ].join(' ');
  }

  const outerAngleInset = r / outerR;
  const innerAngleInset = r / innerR;
  const large = sweep - 2 * outerAngleInset > Math.PI ? 1 : 0;

  const oA = polarPoint(cx, cy, outerR, startAngle + outerAngleInset);
  const oB = polarPoint(cx, cy, outerR, endAngle - outerAngleInset);
  const endOuterEdge = polarPoint(cx, cy, outerR - r, endAngle);
  const endInnerEdge = polarPoint(cx, cy, innerR + r, endAngle);
  const iB = polarPoint(cx, cy, innerR, endAngle - innerAngleInset);
  const iA = polarPoint(cx, cy, innerR, startAngle + innerAngleInset);
  const startInnerEdge = polarPoint(cx, cy, innerR + r, startAngle);
  const startOuterEdge = polarPoint(cx, cy, outerR - r, startAngle);

  return [
    `M ${oA.x} ${oA.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oB.x} ${oB.y}`,
    `Q ${outerEndCorner.x} ${outerEndCorner.y} ${endOuterEdge.x} ${endOuterEdge.y}`,
    `L ${endInnerEdge.x} ${endInnerEdge.y}`,
    `Q ${innerEndCorner.x} ${innerEndCorner.y} ${iB.x} ${iB.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${iA.x} ${iA.y}`,
    `Q ${innerStartCorner.x} ${innerStartCorner.y} ${startInnerEdge.x} ${startInnerEdge.y}`,
    `L ${startOuterEdge.x} ${startOuterEdge.y}`,
    `Q ${outerStartCorner.x} ${outerStartCorner.y} ${oA.x} ${oA.y}`,
    'Z',
  ].join(' ');
}
