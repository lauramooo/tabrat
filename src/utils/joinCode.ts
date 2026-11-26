// Digits only, so the join box can use the number keypad. The database enforces the same shape
// (migration 0010) and swaps in a fresh code if one is ever taken already.
export function generateJoinCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
  return code;
}

// A plain https link (custom app schemes aren't tappable in most messaging apps): the page at
// docs/join.html (GitHub Pages) hands off to tabrat://join/<code>, which src/app/join/[code].tsx
// redeems — or shows the code to type in if the app isn't installed.
const JOIN_PAGE = 'https://lauramooo.github.io/tabrat/join.html';

export function joinLink(code: string): string {
  return `${JOIN_PAGE}?code=${encodeURIComponent(code)}`;
}

// The one invite text for bills, trips and homes.
export function joinInviteMessage(kind: 'bill' | 'trip' | 'home', code: string, name?: string): string {
  const what = kind === 'bill' ? 'bill split' : `${kind}${name ? ` "${name}"` : ''}`;
  return `Join my ${what} on Tab Rat! Tap to join: ${joinLink(code)}\n(or enter code ${code})`;
}
