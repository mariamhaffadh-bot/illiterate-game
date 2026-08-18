/**
 * Persistent word bank — single source of truth for every word ever used.
 * Stores per-category in localStorage. Survives page refreshes and rounds.
 */

const STORAGE_KEY = 'illiterate_usedWords';

function load(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* storage full */ }
}

/** Normalize a word for comparison — catches all variants */
export function normalize(word: string): string {
  return word
    .toLowerCase()
    .replace(/^(the|a|an) /i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Get all used words for a category (normalized) */
export function getUsed(category: string): Set<string> {
  const data = load();
  const key = normalize(category);
  return new Set(data[key] || []);
}

/** Get used words as a raw array (for sending to API) */
export function getUsedArray(category: string): string[] {
  const data = load();
  const key = normalize(category);
  return data[key] || [];
}

/** Mark words as used after generation */
export function markUsed(category: string, words: string[]) {
  const data = load();
  const key = normalize(category);
  const existing = new Set(data[key] || []);
  for (const w of words) {
    const n = normalize(w);
    if (n.length > 0) existing.add(n);
  }
  data[key] = [...existing];
  save(data);
}

/** Check if a single word has been used */
export function isUsed(category: string, word: string): boolean {
  return getUsed(category).has(normalize(word));
}

/** Clear used words for a specific category */
export function clearCategory(category: string) {
  const data = load();
  delete data[normalize(category)];
  save(data);
}

/** Clear everything — full fresh start */
export function clearAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
}
