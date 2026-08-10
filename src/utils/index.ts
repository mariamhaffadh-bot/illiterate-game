export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Normalize a word for duplicate comparison.
 * Trims, lowercases, and normalizes unicode.
 */
export function normalizeWord(word: string): string {
  return word.trim().toLocaleLowerCase().normalize('NFKC');
}

/**
 * Get all 6 words from a card as an array.
 */
export function getCardWords(card: { action: string; object: string; nature: string; random: string; person: string; world: string }): string[] {
  return [card.action, card.object, card.nature, card.random, card.person, card.world].filter((w) => w !== '');
}

const STORAGE_PREFIX = 'wordparty_';

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // noop
    }
  },
};
