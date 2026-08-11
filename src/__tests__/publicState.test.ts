import { describe, it, expect } from 'vitest';
import { createPublicDisplayState } from '../utils/publicState';
import { FORBIDDEN_DISPLAY_KEYS } from '../types/display';
import type { BoardSpace, GameSettings, Player, Team } from '../types';
import { generateBoard } from '../engine/board';
import { DEFAULT_SETTINGS } from '../types';

function makeTestSnapshot(overrides: Record<string, unknown> = {}) {
  const settings: GameSettings = { ...DEFAULT_SETTINGS };
  const boardSpaces: BoardSpace[] = generateBoard(settings.boardSize);
  const players: Player[] = [
    { id: 'p1', name: 'Alice', color: '#EF4444' },
    { id: 'p2', name: 'Bob', color: '#3B82F6' },
    { id: 'p3', name: 'Charlie', color: '#22C55E' },
    { id: 'p4', name: 'Diana', color: '#A855F7' },
  ];
  const teams: Team[] = [
    { id: 't1', name: 'Team Red', color: '#EF4444', playerIds: ['p1', 'p2'], pieceId: 'rocket', boardPosition: 5, currentDescriberIndex: 0 },
    { id: 't2', name: 'Team Blue', color: '#3B82F6', playerIds: ['p3', 'p4'], pieceId: 'crown', boardPosition: 3, currentDescriberIndex: 0 },
  ];

  return {
    phase: 'playing' as const,
    players,
    teams,
    settings,
    boardSpaces,
    currentTeamIndex: 0,
    isPaused: false,
    animatingTeamId: null,
    animationPath: [],
    winnerTeamId: null,
    finishedTeamIds: [],
    redemptionMode: false,
    playingForPlacements: false,
    liveTurnCategory: 'OBJECT' as const,
    liveTurnScore: 4,
    confirmedScore: null,
    turnStartedAt: Date.now() - 20000,
    pausedWithRemaining: null,
    ...overrides,
  };
}

describe('createPublicDisplayState', () => {
  it('should never include forbidden keys (no word leakage)', () => {
    const snapshot = makeTestSnapshot();
    const displayState = createPublicDisplayState('ABC123', snapshot);

    // Verify no forbidden keys exist anywhere in the output
    const json = JSON.stringify(displayState);
    for (const key of FORBIDDEN_DISPLAY_KEYS) {
      expect(json).not.toContain(`"${key}"`);
    }

    // Explicit checks
    expect((displayState as any).currentCard).toBeUndefined();
    expect((displayState as any).deck).toBeUndefined();
    expect((displayState as any).words).toBeUndefined();
    expect((displayState as any).seenWords).toBeUndefined();
    expect((displayState as any).turnAnswers).toBeUndefined();
    expect((displayState as any).cardResults).toBeUndefined();
    expect((displayState as any).liveTurn).toBeUndefined();
    expect((displayState as any).activeCards).toBeUndefined();
    expect((displayState as any).activeCardMap).toBeUndefined();
  });

  it('should include correct board state', () => {
    const snapshot = makeTestSnapshot();
    const displayState = createPublicDisplayState('ABC123', snapshot);

    expect(displayState.gameId).toBe('ABC123');
    expect(displayState.boardSpaces.length).toBe(DEFAULT_SETTINGS.boardSize);
    expect(displayState.teams.length).toBe(2);
  });

  it('should sync board positions correctly', () => {
    const snapshot = makeTestSnapshot({
      teams: [
        { id: 't1', name: 'Team Red', color: '#EF4444', playerIds: ['p1', 'p2'], pieceId: 'rocket', boardPosition: 21, currentDescriberIndex: 0 },
        { id: 't2', name: 'Team Blue', color: '#3B82F6', playerIds: ['p3', 'p4'], pieceId: 'crown', boardPosition: 15, currentDescriberIndex: 0 },
      ],
    });
    const displayState = createPublicDisplayState('GAME01', snapshot);

    expect(displayState.teams[0].boardPosition).toBe(21);
    expect(displayState.teams[1].boardPosition).toBe(15);
  });

  it('should include correct turn state without word data', () => {
    const snapshot = makeTestSnapshot({
      currentTeamIndex: 1,
      liveTurnCategory: 'WORLD' as const,
      liveTurnScore: 3,
    });
    const displayState = createPublicDisplayState('GAME02', snapshot);

    expect(displayState.activeTeamId).toBe('t2');
    expect(displayState.activePlayerName).toBe('Charlie');
    expect(displayState.currentCategory).toBe('WORLD');
    expect(displayState.turnScore).toBe(3);
    expect(displayState.phase).toBe('playing');
  });

  it('should include timer data for sync', () => {
    const startedAt = Date.now() - 30000;
    const snapshot = makeTestSnapshot({ turnStartedAt: startedAt });
    const displayState = createPublicDisplayState('GAME03', snapshot);

    expect(displayState.turnStartedAt).toBe(startedAt);
    expect(displayState.turnDuration).toBe(DEFAULT_SETTINGS.timerDuration);
    expect(displayState.isPaused).toBe(false);
  });

  it('should map team player names correctly', () => {
    const snapshot = makeTestSnapshot();
    const displayState = createPublicDisplayState('GAME04', snapshot);

    expect(displayState.teams[0].playerNames).toEqual(['Alice', 'Bob']);
    expect(displayState.teams[1].playerNames).toEqual(['Charlie', 'Diana']);
  });

  it('should strip sensitive fields from team data', () => {
    const snapshot = makeTestSnapshot();
    const displayState = createPublicDisplayState('GAME05', snapshot);

    for (const team of displayState.teams) {
      expect((team as any).playerIds).toBeUndefined();
      expect((team as any).currentDescriberIndex).toBeUndefined();
    }
  });

  it('should handle game over phase', () => {
    const snapshot = makeTestSnapshot({
      phase: 'game_over' as const,
      winnerTeamId: 't1',
      finishedTeamIds: ['t1'],
    });
    const displayState = createPublicDisplayState('GAME06', snapshot);

    expect(displayState.phase).toBe('game_over');
    expect(displayState.winnerTeamId).toBe('t1');
    expect(displayState.isDraw).toBe(false);
  });

  it('should detect draw correctly', () => {
    const snapshot = makeTestSnapshot({
      phase: 'game_over' as const,
      finishedTeamIds: ['t1', 't2'],
    });
    const displayState = createPublicDisplayState('GAME07', snapshot);

    expect(displayState.isDraw).toBe(true);
  });

  it('should map setup phases to waiting', () => {
    for (const phase of ['home', 'player_setup', 'team_setup', 'game_settings'] as const) {
      const snapshot = makeTestSnapshot({ phase });
      const displayState = createPublicDisplayState('GAME08', snapshot);
      expect(displayState.phase).toBe('waiting');
    }
  });
});
