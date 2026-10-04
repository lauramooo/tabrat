// "YYYY-MM-DD" has no time component, so JS's Date parser treats it as UTC midnight — reading it
// back with local getters (getMonth/getFullYear/getDate) then shifts it a day earlier in any
// timezone behind UTC, which silently drops date-only values into the wrong month. Parse those
// as local-midnight instead; anything with a time/offset (e.g. a real ISO timestamp) is left to
// the normal parser since it already carries real UTC information worth converting.
export function parseLocalDate(d: Date | string): Date {
  if (typeof d !== 'string') return d;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(d);
}

export function fmtDate(d: Date | string): string {
  const date = parseLocalDate(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtMonthYear(d: Date | string): string {
  const date = parseLocalDate(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// For tight date pills (side-by-side start/end date fields) where a full 4-digit year is often
// what pushes a date onto a second line — e.g. "Sep 21, 26" instead of "Sep 21, 2026". Not a
// replacement for fmtDate everywhere; only where horizontal space is genuinely constrained.
export function fmtDateShort(d: Date | string): string {
  const date = parseLocalDate(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtMonthAbbr(d: Date): string {
  return `${d.toLocaleDateString('en-US', { month: 'short' })}.`;
}

// The single combined "when" field for a trip — one date reads "Sep. 17, 2026"; a range collapses
// the shared month/year rather than repeating them: "Sep. 17-28, 2026" (same month), "Sep. 28 -
// Oct. 5, 2026" (crosses a month), or "Dec. 28, 2026 - Jan. 3, 2027" (crosses a year).
export function fmtDateRange(start: Date | string, end?: Date | string | null): string {
  const s = parseLocalDate(start);
  if (isNaN(s.getTime())) return '';
  if (!end) return `${fmtMonthAbbr(s)} ${s.getDate()}, ${s.getFullYear()}`;
  const e = parseLocalDate(end);
  if (isNaN(e.getTime())) return `${fmtMonthAbbr(s)} ${s.getDate()}, ${s.getFullYear()}`;
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${fmtMonthAbbr(s)} ${s.getDate()}-${e.getDate()}, ${s.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${fmtMonthAbbr(s)} ${s.getDate()} - ${fmtMonthAbbr(e)} ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${fmtMonthAbbr(s)} ${s.getDate()}, ${s.getFullYear()} - ${fmtMonthAbbr(e)} ${e.getDate()}, ${e.getFullYear()}`;
}
