// Digits only, so the join box can use the number keypad. The database enforces the same shape
// (migration 0010) and swaps in a fresh code if one is ever taken already.
export function generateJoinCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
  return code;
}

// A Universal Link: with Tab Rat installed, iOS opens it straight in the app (verified by the
// apple-app-site-association file in the lauramooo.github.io repo), and src/app/+native-intent.tsx
// routes it to the join screen. Without the app, it falls back to docs/join.html, which shows the
// code to enter. Custom-scheme links (tabrat://) aren't tappable in most messaging apps.
const JOIN_PAGE = 'https://lauramooo.github.io/tabrat/join';

export function joinLink(code: string): string {
  return `${JOIN_PAGE}?code=${encodeURIComponent(code)}`;
}

// The one invite text for bills, trips and homes.
export function joinInviteMessage(kind: 'bill' | 'trip' | 'home', code: string, name?: string): string {
  const what = kind === 'bill' ? 'bill split' : `${kind}${name ? ` "${name}"` : ''}`;
  return `Join my ${what} on Tab Rat! Tap to join: ${joinLink(code)}\n(or enter code ${code})`;
}
