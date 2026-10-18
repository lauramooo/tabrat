// Edit on a trip/home's Expenses tab hands off to its Dashboard tab, where the edit form lives:
// the Expenses tab sets this and goes back; the Dashboard opens the form when it regains focus.
let pendingId: string | null = null;

export function requestGroupEdit(id: string) { pendingId = id; }

export function takeGroupEditRequest(id: string): boolean {
  if (pendingId !== id) return false;
  pendingId = null;
  return true;
}
