import type { BaseCategory, BoardCategory, Card, DeckState, Difficulty, DifficultySelection } from '../types';
import { MIXED_DISTRIBUTION, BASE_CATEGORIES } from '../types';
import { shuffleArray, normalizeWord, getCardWords } from '../utils';

/**
 * Filter cards by difficulty selection.
 * For 'mixed', include all cards (proportional drawing happens via shuffle weighting).
 * For a specific difficulty, include only cards of that difficulty.
 */
export function filterCardsByDifficulty(cards: Card[], difficulty: DifficultySelection): Card[] {
  if (difficulty === 'mixed') return cards;
  return cards.filter((c) => c.difficulty === difficulty);
}

/**
 * Create a shuffled deck from filtered cards.
 * For 'mixed' mode, we weight the shuffle to approximate the target distribution.
 */
export function createDeck(cards: Card[], difficulty: DifficultySelection): DeckState {
  let pool: Card[];

  if (difficulty === 'mixed') {
    // Build a weighted pool: repeat cards proportionally to their difficulty weight
    pool = [];
    const byDiff = new Map<Difficulty, Card[]>();
    for (const c of cards) {
      if (!byDiff.has(c.difficulty)) byDiff.set(c.difficulty, []);
      byDiff.get(c.difficulty)!.push(c);
    }

    // Calculate how many cards of each difficulty to include
    // Use the full pool but shuffle in proportional order
    const totalTarget = cards.length;
    const included = new Set<string>();

    for (const [diff, weight] of Object.entries(MIXED_DISTRIBUTION) as [Difficulty, number][]) {
      const diffCards = byDiff.get(diff) || [];
      const shuffled = shuffleArray(diffCards);
      const count = Math.round(totalTarget * weight);
      for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        if (!included.has(shuffled[i].id)) {
          pool.push(shuffled[i]);
          included.add(shuffled[i].id);
        }
      }
    }

    // Add any remaining cards not yet included
    for (const c of cards) {
      if (!included.has(c.id)) {
        pool.push(c);
        included.add(c.id);
      }
    }
  } else {
    pool = filterCardsByDifficulty(cards, difficulty);
  }

  return {
    shuffledCardIds: shuffleArray(pool.map((c) => c.id)),
    cursor: 0,
    seenWords: [],
  };
}

/**
 * Check if a card is safe to draw — none of its 6 words have been seen before.
 */
function isCardClean(card: Card, seenWordsSet: Set<string>): boolean {
  const words = getCardWords(card);
  for (const w of words) {
    if (seenWordsSet.has(normalizeWord(w))) return false;
  }
  return true;
}

/**
 * Draw the next card from the deck.
 * Skips cards whose words conflict with already-seen words.
 * Returns null if deck is exhausted or no clean cards remain.
 *
 * When a card is drawn, ALL 6 of its words are added to seenWords
 * because the player sees the entire card.
 */
export function drawCard(
  deck: DeckState,
  cardMap: Map<string, Card>
): { card: Card; newDeck: DeckState } | null {
  const seenWordsSet = new Set(deck.seenWords);
  let cursor = deck.cursor;

  while (cursor < deck.shuffledCardIds.length) {
    const cardId = deck.shuffledCardIds[cursor];
    const card = cardMap.get(cardId);
    cursor++;

    if (!card) continue;

    if (isCardClean(card, seenWordsSet)) {
      // Mark all 6 words as seen
      const newSeenWords = [...deck.seenWords];
      for (const w of getCardWords(card)) {
        const norm = normalizeWord(w);
        if (!seenWordsSet.has(norm)) {
          newSeenWords.push(norm);
          seenWordsSet.add(norm);
        }
      }

      return {
        card,
        newDeck: {
          shuffledCardIds: deck.shuffledCardIds,
          cursor,
          seenWords: newSeenWords,
        },
      };
    }
    // Card has a word conflict — skip it
  }

  return null; // Deck exhausted
}

/**
 * Check if the deck is exhausted (cursor past end).
 */
export function isDeckExhausted(deck: DeckState): boolean {
  return deck.cursor >= deck.shuffledCardIds.length;
}

/**
 * Get approximate remaining drawable cards.
 */
export function remainingCards(deck: DeckState): number {
  return Math.max(0, deck.shuffledCardIds.length - deck.cursor);
}

/**
 * Get the word from a card for a given board category.
 * For SPADE, returns the word from whichever base category the ♠ sits on.
 */
export function getCategoryWord(card: Card, category: BoardCategory): string {
  const resolvedCategory = category === 'SPADE' ? card.spadeCategory : category;
  const key = resolvedCategory.toLowerCase() as keyof Pick<Card, 'action' | 'object' | 'nature' | 'random' | 'person' | 'world'>;
  return card[key];
}

/**
 * Reshuffle the entire deck (only when user explicitly requests).
 */
export function reshuffleDeck(cards: Card[], difficulty: DifficultySelection): DeckState {
  return createDeck(cards, difficulty);
}

/**
 * Generate cards from fetched word lists for custom categories.
 * wordLists[i] maps to activeCategories[i].
 */
export function generateCustomCards(
  wordLists: string[][],
  activeCategories: BaseCategory[]
): Card[] {
  // Filter out empty word lists and their categories
  const validPairs = wordLists
    .map((list, i) => ({ list, cat: activeCategories[i] }))
    .filter((p) => p.list.length > 0);

  if (validPairs.length < 2) return [];

  const shuffled = validPairs.map((p) => shuffleArray([...p.list]));
  const activeCats = validPairs.map((p) => p.cat);
  const maxCards = Math.min(...shuffled.map((l) => l.length));
  const cards: Card[] = [];

  for (let i = 0; i < maxCards; i++) {
    const card: Card = {
      id: `custom_${i}`,
      action: '',
      object: '',
      nature: '',
      random: '',
      person: '',
      world: '',
      difficulty: 'normal',
      isSpade: Math.random() < 0.15,
      spadeCategory: activeCats[Math.floor(Math.random() * activeCats.length)],
    };

    for (let j = 0; j < activeCats.length; j++) {
      const key = activeCats[j].toLowerCase() as 'action' | 'object' | 'nature' | 'random' | 'person' | 'world';
      card[key] = shuffled[j][i];
    }

    cards.push(card);
  }

  return cards;
}
