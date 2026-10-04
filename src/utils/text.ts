// Sentence case: capitalize only the first letter of the first word. Brand names are proper
// nouns, not a Title Case violation — sentence-casing "Continue with Google" into "with google"
// misspells the brand, so their capitalization survives the lowercase pass.
const PROPER_NOUNS = ['Apple', 'Google', 'Facebook'];

export function toSentenceCase(str: string): string {
  if (!str) return str;
  const sentenceCased = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  return PROPER_NOUNS.reduce(
    (result, word) => result.replace(new RegExp(`\\b${word}\\b`, 'gi'), word),
    sentenceCased,
  );
}

// Live text-shortcut replacements applied as the user types in the shared Input component.
export function applyTextShortcuts(str: string): string {
  return str.replace(/->/g, '→');
}
