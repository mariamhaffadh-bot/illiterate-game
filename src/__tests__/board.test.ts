import { describe, it, expect } from 'vitest';
import {
  generateBoard,
  getCategoryAtPosition,
  calculateNewPosition,
  hasTeamFinished,
  computeBoardGeometry,
} from '../engine/board';
import { BOARD_CATEGORIES } from '../types';

describe('Board Engine', () => {
  it('should generate correct number of spaces', () => {
    const board = generateBoard(36);
    expect(board.length).toBe(36);
  });

  it('should cycle through 7 categories including SPADE', () => {
    const board = generateBoard(42);
    // 42 spaces = 6 full cycles of 7 categories
    for (let i = 0; i < 42; i++) {
      expect(board[i].category).toBe(BOARD_CATEGORIES[i % 7]);
    }
    // Verify SPADE appears
    const spadeSpaces = board.filter((s) => s.category === 'SPADE');
    expect(spadeSpaces.length).toBe(6);
  });

  it('space 0 should be START type', () => {
    const board = generateBoard(36);
    expect(board[0].type).toBe('START');
  });

  it('non-zero spaces should be NORMAL type', () => {
    const board = generateBoard(36);
    for (let i = 1; i < 36; i++) {
      expect(board[i].type).toBe('NORMAL');
    }
  });

  it('team position 8 + confirmed score 6 = destination 14', () => {
    const newPos = calculateNewPosition(8, 6, 36);
    expect(newPos).toBe(14);
  });

  it('team position 0 + score 5 = position 5', () => {
    const newPos = calculateNewPosition(0, 5, 36);
    expect(newPos).toBe(5);
  });

  it('team position 33 + score 5 = position 38 (past finish)', () => {
    const newPos = calculateNewPosition(33, 5, 36);
    expect(newPos).toBe(38);
  });

  it('hasTeamFinished: position < boardSize = false', () => {
    expect(hasTeamFinished(35, 36)).toBe(false);
  });

  it('hasTeamFinished: position = boardSize = true', () => {
    expect(hasTeamFinished(36, 36)).toBe(true);
  });

  it('hasTeamFinished: position > boardSize = true', () => {
    expect(hasTeamFinished(40, 36)).toBe(true);
  });

  it('getCategoryAtPosition returns correct category', () => {
    const board = generateBoard(42);
    // Position 0 = ACTION (first in BOARD_CATEGORIES)
    expect(getCategoryAtPosition(board, 0)).toBe('ACTION');
    // Position 1 = OBJECT
    expect(getCategoryAtPosition(board, 1)).toBe('OBJECT');
    // Position 5 = WORLD
    expect(getCategoryAtPosition(board, 5)).toBe('WORLD');
    // Position 6 = SPADE (7th category)
    expect(getCategoryAtPosition(board, 6)).toBe('SPADE');
    // Position 7 = ACTION (wraps)
    expect(getCategoryAtPosition(board, 7)).toBe('ACTION');
  });

  it('getCategoryAtPosition clamps to valid range', () => {
    const board = generateBoard(36);
    // Position beyond board clamps to last space
    expect(getCategoryAtPosition(board, 100)).toBe(board[35].category);
    // Negative clamps to 0
    expect(getCategoryAtPosition(board, -5)).toBe(board[0].category);
  });

  it('computeBoardGeometry produces correct number of segments', () => {
    const geo = computeBoardGeometry(36);
    expect(geo.length).toBe(36);
  });

  it('each geometry segment has a valid SVG path', () => {
    const geo = computeBoardGeometry(36);
    for (const g of geo) {
      expect(g.path).toContain('M');
      expect(g.path).toContain('A');
      expect(g.path).toContain('Z');
    }
  });

  it('geometry centers are within board bounds', () => {
    const geo = computeBoardGeometry(36, 500, 500, 300, 430);
    for (const g of geo) {
      const dx = g.center.x - 500;
      const dy = g.center.y - 500;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Should be between inner and outer radius
      expect(dist).toBeGreaterThan(290);
      expect(dist).toBeLessThan(440);
    }
  });

  it('board wrapping scenario: position tracks correctly through full game', () => {
    generateBoard(36);

    // Simulate a team going around the board
    let position = 0;
    const moves = [3, 5, 7, 4, 6, 2, 5, 8]; // total = 40, should pass finish (36)

    for (const move of moves) {
      position = calculateNewPosition(position, move, 36);
      if (hasTeamFinished(position, 36)) break;
    }

    // After move total exceeds 36, team should have finished
    expect(hasTeamFinished(position, 36)).toBe(true);
  });
});
