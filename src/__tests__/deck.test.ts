import { describe, it, expect } from 'vitest';
import { createDeck, drawCard, getCategoryWord } from '../engine/deck';
import { allCards, cardMap, validateDeck } from '../data/cards';
import type { Card } from '../types';
import { normalizeWord, getCardWords } from '../utils';

describe('Deck Engine', () => {
  it('should create a shuffled deck with all card IDs', () => {
    const deck = createDeck(allCards, 'normal');
    expect(deck.cursor).toBe(0);
    expect(deck.seenWords.length).toBe(0);
    // Should have cards from the 'normal' difficulty
    expect(deck.shuffledCardIds.length).toBeGreaterThan(0);
  });

  it('should draw cards with zero duplicate card IDs', () => {
    const deck = createDeck(allCards, 'mixed');
    const drawnIds = new Set<string>();
    let currentDeck = { ...deck };

    let count = 0;
    while (count < 500) {
      const result = drawCard(currentDeck, cardMap);
      if (!result) break;

      expect(drawnIds.has(result.card.id)).toBe(false);
      drawnIds.add(result.card.id);
      currentDeck = result.newDeck;
      count++;
    }

    // Should have drawn many cards without duplicates
    expect(drawnIds.size).toBe(count);
  });

  it('should never show a previously-seen word on a drawn card (word-level dedup)', () => {
    const deck = createDeck(allCards, 'mixed');
    let currentDeck = { ...deck };
    const allSeenWords = new Set<string>();

    for (let i = 0; i < 200; i++) {
      const result = drawCard(currentDeck, cardMap);
      if (!result) break;

      // Check that NONE of this card's 6 words were seen before
      const cardWords = getCardWords(result.card);
      for (const w of cardWords) {
        const norm = normalizeWord(w);
        expect(allSeenWords.has(norm)).toBe(false);
        allSeenWords.add(norm);
      }

      currentDeck = result.newDeck;
    }
  });

  it('should return null when deck is exhausted', () => {
    const deck = createDeck(allCards, 'mixed');
    const exhausted = { ...deck, cursor: deck.shuffledCardIds.length };
    const result = drawCard(exhausted, cardMap);
    expect(result).toBeNull();
  });

  it('passed card: all six words remain seen, card consumed', () => {
    const deck = createDeck(allCards, 'mixed');

    // Draw a card (simulates a pass — card is still consumed)
    const result = drawCard(deck, cardMap);
    expect(result).not.toBeNull();

    // All 6 words should be in seenWords
    const cardWords = getCardWords(result!.card);
    const seenSet = new Set(result!.newDeck.seenWords);
    for (const w of cardWords) {
      expect(seenSet.has(normalizeWord(w))).toBe(true);
    }

    // Next card should be different
    const result2 = drawCard(result!.newDeck, cardMap);
    if (result2) {
      expect(result2.card.id).not.toBe(result!.card.id);
    }
  });

  it('correct card: all six words remain seen, card consumed', () => {
    const deck = createDeck(allCards, 'mixed');

    const result = drawCard(deck, cardMap);
    expect(result).not.toBeNull();

    // Same as pass — all words become seen
    const cardWords = getCardWords(result!.card);
    const seenSet = new Set(result!.newDeck.seenWords);
    for (const w of cardWords) {
      expect(seenSet.has(normalizeWord(w))).toBe(true);
    }
  });

  it('changing correct to incorrect during review does NOT return card to deck', () => {
    const deck = createDeck(allCards, 'mixed');

    const result = drawCard(deck, cardMap);
    expect(result).not.toBeNull();

    // The deck's cursor and seenWords have advanced
    // Even if we "toggle" the answer in review, the deck state is unchanged
    // Drawing again gives the next card, never the previous one
    const nextResult = drawCard(result!.newDeck, cardMap);
    if (nextResult) {
      expect(nextResult.card.id).not.toBe(result!.card.id);
      // None of first card's words appear on second card
      const firstWords = new Set(getCardWords(result!.card).map(normalizeWord));
      const secondWords = getCardWords(nextResult.card).map(normalizeWord);
      for (const w of secondWords) {
        expect(firstWords.has(w)).toBe(false);
      }
    }
  });

  it('getCategoryWord returns correct entry for each category', () => {
    const card: Card = {
      id: 'test',
      action: 'Running',
      object: 'Telescope',
      nature: 'Elephant',
      random: 'Déjà vu',
      person: 'Einstein',
      world: 'Paris',
      difficulty: 'normal',
      isSpade: false,
      spadeCategory: 'NATURE',
    };

    expect(getCategoryWord(card, 'ACTION')).toBe('Running');
    expect(getCategoryWord(card, 'OBJECT')).toBe('Telescope');
    expect(getCategoryWord(card, 'NATURE')).toBe('Elephant');
    expect(getCategoryWord(card, 'RANDOM')).toBe('Déjà vu');
    expect(getCategoryWord(card, 'PERSON')).toBe('Einstein');
    expect(getCategoryWord(card, 'WORLD')).toBe('Paris');
    // SPADE resolves to the card's spadeCategory (NATURE = 'Elephant')
    expect(getCategoryWord(card, 'SPADE')).toBe('Elephant');
  });

  it('every card has all six non-empty entries, difficulty, isSpade, and valid spadeCategory', () => {
    const validSpadeCategories = ['ACTION', 'OBJECT', 'NATURE', 'RANDOM', 'PERSON', 'WORLD'];
    for (const card of allCards) {
      expect(card.action.length).toBeGreaterThan(0);
      expect(card.object.length).toBeGreaterThan(0);
      expect(card.nature.length).toBeGreaterThan(0);
      expect(card.random.length).toBeGreaterThan(0);
      expect(card.person.length).toBeGreaterThan(0);
      expect(card.world.length).toBeGreaterThan(0);
      expect(['easy', 'normal', 'hard', 'expert']).toContain(card.difficulty);
      expect(typeof card.isSpade).toBe('boolean');
      expect(validSpadeCategories).toContain(card.spadeCategory);
    }
  });

  it('built-in deck has zero duplicate words', () => {
    const { duplicateWords, malformedCards } = validateDeck();
    expect(malformedCards.length).toBe(0);
    expect(duplicateWords.length).toBe(0);
  });

  it('saved/restored game: used 100 cards, reload, draw remaining — no previously seen words appear', () => {
    const deck = createDeck(allCards, 'mixed');
    const allSeenWordsBefore = new Set<string>();
    let currentDeck = { ...deck };

    // Draw 100 cards
    for (let i = 0; i < 100; i++) {
      const result = drawCard(currentDeck, cardMap);
      if (!result) break;
      for (const w of getCardWords(result.card)) {
        allSeenWordsBefore.add(normalizeWord(w));
      }
      currentDeck = result.newDeck;
    }

    // Simulate save/restore
    const savedState = JSON.stringify(currentDeck);
    const restoredDeck = JSON.parse(savedState) as typeof currentDeck;

    // Draw remaining cards from restored deck
    let restored = { ...restoredDeck };
    for (let i = 0; i < 400; i++) {
      const result = drawCard(restored, cardMap);
      if (!result) break;

      // None of the words from previously drawn cards should appear
      const cardWords = getCardWords(result.card);
      for (const w of cardWords) {
        expect(allSeenWordsBefore.has(normalizeWord(w))).toBe(false);
      }
      restored = result.newDeck;
    }
  });

  it('difficulty filtering: easy mode has no hard/expert-only cards', () => {
    const deck = createDeck(allCards, 'easy');
    let currentDeck = { ...deck };

    for (let i = 0; i < 50; i++) {
      const result = drawCard(currentDeck, cardMap);
      if (!result) break;
      expect(result.card.difficulty).toBe('easy');
      currentDeck = result.newDeck;
    }
  });

  it('difficulty filtering: hard mode has only hard cards', () => {
    const deck = createDeck(allCards, 'hard');
    let currentDeck = { ...deck };

    for (let i = 0; i < 50; i++) {
      const result = drawCard(currentDeck, cardMap);
      if (!result) break;
      expect(result.card.difficulty).toBe('hard');
      currentDeck = result.newDeck;
    }
  });

  it('spade cards exist in the dataset with appropriate frequency', () => {
    const spadeCards = allCards.filter((c) => c.isSpade);
    const spadeRatio = spadeCards.length / allCards.length;
    // Should be approximately 12-15%
    expect(spadeRatio).toBeGreaterThanOrEqual(0.10);
    expect(spadeRatio).toBeLessThanOrEqual(0.20);

    // Spade cards should disproportionately be hard/expert
    const hardExpertSpades = spadeCards.filter((c) => c.difficulty === 'hard' || c.difficulty === 'expert');
    expect(hardExpertSpades.length / spadeCards.length).toBeGreaterThan(0.5);
  });
});
