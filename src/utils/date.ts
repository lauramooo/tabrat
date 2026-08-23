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
