// Digits only, so the join box can use the number keypad. The database enforces the same shape
// (migration 0010) and swaps in a fresh code if one is ever taken already.
export function generateJoinCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
  return code;
}
