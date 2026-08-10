import { create } from 'zustand';
import type {
  BoardCategory,
  Card,
  DeckState,
  GamePhase,
  GameSettings,
  Player,
  Team,
  TurnCardResult,
  TurnRecord,
} from '../types';
import {
  DEFAULT_SETTINGS,
  PLAYER_COLORS,
  TEAM_COLORS,
  getActiveBaseCategories,
  getActiveBoardCategories,
} from '../types';
import { allCards, cardMap } from '../data/cards';
import { generateId, storage } from '../utils';
import { generateBoard, getCategoryAtPosition, calculateNewPosition, hasTeamFinished } from '../engine/board';
import { createDeck, drawCard as rawDrawCard, getCategoryWord, generateCustomCards } from '../engine/deck';
import { fetchWordsForCategory } from '../utils/fetchWords';

/**
 * Draw a card, automatically reshuffling the deck if exhausted.
 * Guarantees a card is always returned as long as the dataset has cards.
 */
function drawCardOrReshuffle(
  deck: DeckState,
  difficulty: GameSettings['difficulty'],
  cards: Card[],
  cMap: Map<string, Card>
): { card: Card; newDeck: DeckState } | null {
  const result = rawDrawCard(deck, cMap);
  if (result) return result;

  // Deck exhausted — reshuffle with fresh seenWords
  const freshDeck = createDeck(cards, difficulty);
  return rawDrawCard(freshDeck, cMap);
}

// ── Auto-assign players to N teams ──────────────────────────────

function autoAssignTeams(playerIds: string[], teamCount: number): string[][] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const teams: string[][] = Array.from({ length: teamCount }, () => []);
  shuffled.forEach((id, i) => { teams[i % teamCount].push(id); });
  return teams;
}

/** Get the next team index that hasn't finished, wrapping around. */
function getNextActiveTeamIndex(current: number, teams: Team[], finishedIds: string[]): number {
  let next = (current + 1) % teams.length;
  let safety = 0;
  while (finishedIds.includes(teams[next].id) && safety < teams.length) {
    next = (next + 1) % teams.length;
    safety++;
  }
  return next;
}

// ── Store types ─────────────────────────────────────────────────

interface LiveTurn {
  teamId: string;
  playerId: string;
  category: BoardCategory;
  startPosition: number;
  cardResults: TurnCardResult[];
  currentCard: Card | null;
}

interface GameStore {
  // State
  phase: GamePhase;
  players: Player[];
  teams: Team[];
  settings: GameSettings;
  boardSpaces: ReturnType<typeof generateBoard>;
  deck: DeckState;
  currentTeamIndex: number;
  turnHistory: TurnRecord[];
  liveTurn: LiveTurn | null;
  isPaused: boolean;
  animatingTeamId: string | null;
  animationPath: number[];
  winnerTeamId: string | null;
  activeCards: Card[];
  activeCardMap: Map<string, Card>;
  isLoadingCustomWords: boolean;
  finishedTeamIds: string[];
  redemptionMode: boolean;
  redemptionTurnsRemaining: number;
  playingForPlacements: boolean;

  // Player management
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;

  // Team management
  createTeams: (count: number) => void;
  autoAssign: () => void;
  movePlayerToTeam: (playerId: string, teamId: string) => void;
  removePlayerFromTeam: (playerId: string) => void;
  updateTeamName: (teamId: string, name: string) => void;
  setTeamPiece: (teamId: string, pieceId: string) => void;
  addTeam: () => void;
  removeTeam: (teamId: string) => void;

  // Settings
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Game flow
  setPhase: (phase: GamePhase) => void;
  startGame: () => void;
  startTurn: () => void;
  markCorrect: () => void;
  markPass: () => void;
  endTimer: () => void;
  toggleReviewItem: (index: number) => void;
  confirmScore: () => void;
  finishPieceAnimation: () => void;
  togglePause: () => void;

  // Redemption & placements
  continueForPlacements: () => void;

  // Persistence
  saveState: () => void;
  loadSavedGame: () => boolean;
  clearSavedGame: () => void;
  resetGame: () => void;
  goHome: () => void;

  // Deck
  reshuffleDeck: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'home',
  players: [],
  teams: [],
  settings: { ...DEFAULT_SETTINGS },
  boardSpaces: generateBoard(DEFAULT_SETTINGS.boardSize),
  deck: { shuffledCardIds: [], cursor: 0, seenWords: [] },
  currentTeamIndex: 0,
  turnHistory: [],
  liveTurn: null,
  isPaused: false,
  animatingTeamId: null,
  animationPath: [],
  winnerTeamId: null,
  activeCards: allCards,
  activeCardMap: cardMap,
  isLoadingCustomWords: false,
  finishedTeamIds: [],
  redemptionMode: false,
  redemptionTurnsRemaining: 0,
  playingForPlacements: false,

  // ── Player management ──────────────────────────────────────────

  addPlayer: (name) => {
    const { players } = get();
    const color = PLAYER_COLORS[players.length % PLAYER_COLORS.length];
    set({ players: [...players, { id: generateId(), name: name.trim(), color }] });
  },

  removePlayer: (id) => {
    const { players, teams } = get();
    set({
      players: players.filter((p) => p.id !== id),
      teams: teams.map((t) => ({
        ...t,
        playerIds: t.playerIds.filter((pid) => pid !== id),
      })),
    });
  },

  // ── Team management ────────────────────────────────────────────

  createTeams: (count) => {
    const teams: Team[] = [];
    const defaultPieces = ['rocket', 'crown', 'bolt', 'star', 'diamond', 'ghost', 'flame', 'planet'];
    for (let i = 0; i < count; i++) {
      const tc = TEAM_COLORS[i % TEAM_COLORS.length];
      teams.push({
        id: generateId(),
        name: `Team ${tc.name}`,
        color: tc.bg,
        playerIds: [],
        pieceId: defaultPieces[i] || defaultPieces[0],
        boardPosition: 0,
        currentDescriberIndex: 0,
      });
    }
    set({ teams });
  },

  autoAssign: () => {
    const { players, teams } = get();
    if (teams.length === 0 || players.length === 0) return;
    const assignments = autoAssignTeams(players.map((p) => p.id), teams.length);
    set({
      teams: teams.map((t, i) => ({ ...t, playerIds: assignments[i] || [] })),
    });
  },

  movePlayerToTeam: (playerId, teamId) => {
    const { teams } = get();
    set({
      teams: teams.map((t) => {
        const without = t.playerIds.filter((pid) => pid !== playerId);
        if (t.id === teamId) return { ...t, playerIds: [...without, playerId] };
        return { ...t, playerIds: without };
      }),
    });
  },

  removePlayerFromTeam: (playerId) => {
    const { teams } = get();
    set({
      teams: teams.map((t) => ({
        ...t,
        playerIds: t.playerIds.filter((pid) => pid !== playerId),
      })),
    });
  },

  updateTeamName: (teamId, name) => {
    const { teams } = get();
    set({ teams: teams.map((t) => (t.id === teamId ? { ...t, name } : t)) });
  },

  setTeamPiece: (teamId, pieceId) => {
    const { teams } = get();
    set({ teams: teams.map((t) => (t.id === teamId ? { ...t, pieceId } : t)) });
  },

  addTeam: () => {
    const { teams } = get();
    const idx = teams.length;
    const tc = TEAM_COLORS[idx % TEAM_COLORS.length];
    const defaultPieces = ['rocket', 'crown', 'bolt', 'star', 'diamond', 'ghost', 'flame', 'planet'];
    const usedPieces = new Set(teams.map((t) => t.pieceId));
    const pieceId = defaultPieces.find((p) => !usedPieces.has(p)) || defaultPieces[0];
    set({
      teams: [
        ...teams,
        {
          id: generateId(),
          name: `Team ${tc.name}`,
          color: tc.bg,
          playerIds: [],
          pieceId,
          boardPosition: 0,
          currentDescriberIndex: 0,
        },
      ],
    });
  },

  removeTeam: (teamId) => {
    const { teams } = get();
    set({ teams: teams.filter((t) => t.id !== teamId) });
  },

  // ── Settings ───────────────────────────────────────────────────

  updateSettings: (partial) => {
    const { settings } = get();
    const newSettings = { ...settings, ...partial };
    const boardCats = newSettings.useCustomCategories
      ? getActiveBoardCategories(newSettings)
      : undefined;
    set({
      settings: newSettings,
      boardSpaces: generateBoard(newSettings.boardSize, boardCats),
    });
  },

  setPhase: (phase) => set({ phase }),

  // ── Game flow ──────────────────────────────────────────────────

  startGame: async () => {
    const { settings } = get();

    let cards = allCards;
    let cMap = cardMap;
    const boardCats = settings.useCustomCategories
      ? getActiveBoardCategories(settings)
      : undefined;

    if (settings.useCustomCategories && settings.customCategoryNames.length >= 2) {
      set({ isLoadingCustomWords: true });
      try {
        const activeBase = getActiveBaseCategories(settings);
        // Fetch categories sequentially to avoid Wikipedia rate limits
        const wordLists: string[][] = [];
        for (const name of settings.customCategoryNames) {
          const words = await fetchWordsForCategory(name);
          wordLists.push(words);
        }
        const customCards = generateCustomCards(wordLists, activeBase);
        if (customCards.length === 0) {
          console.warn('No cards generated — word lists may be empty:', wordLists.map((l) => l.length));
          set({ isLoadingCustomWords: false });
          return;
        }
        cards = customCards;
        cMap = new Map(cards.map((c) => [c.id, c]));
      } catch (e) {
        console.error('Failed to fetch custom words:', e);
        set({ isLoadingCustomWords: false });
        return;
      }
      set({ isLoadingCustomWords: false });
    }

    const board = generateBoard(settings.boardSize, boardCats);
    const deck = createDeck(cards, settings.difficulty);
    set({
      phase: 'turn_intro',
      boardSpaces: board,
      deck,
      activeCards: cards,
      activeCardMap: cMap,
      currentTeamIndex: 0,
      turnHistory: [],
      liveTurn: null,
      animatingTeamId: null,
      animationPath: [],
      winnerTeamId: null,
      finishedTeamIds: [],
      redemptionMode: false,
      redemptionTurnsRemaining: 0,
      playingForPlacements: false,
      teams: get().teams.map((t) => ({
        ...t,
        boardPosition: 0,
        currentDescriberIndex: 0,
      })),
    });
    get().saveState();
  },

  startTurn: () => {
    const { teams, currentTeamIndex, boardSpaces, deck, activeCards, activeCardMap } = get();
    const team = teams[currentTeamIndex];
    const category = getCategoryAtPosition(boardSpaces, team.boardPosition);
    const playerId = team.playerIds[team.currentDescriberIndex % team.playerIds.length];

    // Draw the first card
    const result = drawCardOrReshuffle(deck, get().settings.difficulty, activeCards, activeCardMap);
    let currentCard: Card | null = null;
    let newDeck = deck;
    if (result) {
      currentCard = result.card;
      newDeck = result.newDeck;
    }

    set({
      phase: 'playing',
      isPaused: false,
      deck: newDeck,
      liveTurn: {
        teamId: team.id,
        playerId,
        category,
        startPosition: team.boardPosition,
        cardResults: [],
        currentCard,
      },
    });
  },

  markCorrect: () => {
    const { liveTurn, deck, activeCards, activeCardMap } = get();
    if (!liveTurn || !liveTurn.currentCard) return;

    const word = getCategoryWord(liveTurn.currentCard, liveTurn.category);
    const isSpadeTurn = liveTurn.category === 'SPADE';
    const newResults: TurnCardResult[] = [
      ...liveTurn.cardResults,
      {
        cardId: liveTurn.currentCard.id,
        word,
        markedCorrect: true,
        confirmedCorrect: true,
        isSpade: isSpadeTurn,
      },
    ];

    // Draw next card
    const result = drawCardOrReshuffle(deck, get().settings.difficulty, activeCards, activeCardMap);
    let nextCard: Card | null = null;
    let newDeck = deck;
    if (result) {
      nextCard = result.card;
      newDeck = result.newDeck;
    }

    set({
      deck: newDeck,
      liveTurn: { ...liveTurn, cardResults: newResults, currentCard: nextCard },
    });
  },

  markPass: () => {
    const { liveTurn, deck, activeCards, activeCardMap } = get();
    if (!liveTurn || !liveTurn.currentCard) return;

    const word = getCategoryWord(liveTurn.currentCard, liveTurn.category);
    const isSpadeTurn = liveTurn.category === 'SPADE';
    const newResults: TurnCardResult[] = [
      ...liveTurn.cardResults,
      {
        cardId: liveTurn.currentCard.id,
        word,
        markedCorrect: false,
        confirmedCorrect: false,
        isSpade: isSpadeTurn,
      },
    ];

    // Draw next card
    const result = drawCardOrReshuffle(deck, get().settings.difficulty, activeCards, activeCardMap);
    let nextCard: Card | null = null;
    let newDeck = deck;
    if (result) {
      nextCard = result.card;
      newDeck = result.newDeck;
    }

    set({
      deck: newDeck,
      liveTurn: { ...liveTurn, cardResults: newResults, currentCard: nextCard },
    });
  },

  endTimer: () => {
    set({ phase: 'turn_review' });
  },

  toggleReviewItem: (index) => {
    const { liveTurn } = get();
    if (!liveTurn) return;
    const newResults = [...liveTurn.cardResults];
    newResults[index] = {
      ...newResults[index],
      confirmedCorrect: !newResults[index].confirmedCorrect,
    };
    set({ liveTurn: { ...liveTurn, cardResults: newResults } });
  },

  confirmScore: () => {
    const {
      liveTurn, teams, currentTeamIndex, turnHistory, settings,
      redemptionMode, redemptionTurnsRemaining, finishedTeamIds, playingForPlacements,
    } = get();
    if (!liveTurn) return;

    const confirmedScore = liveTurn.cardResults.filter((c) => c.confirmedCorrect).length;
    const team = teams[currentTeamIndex];
    const newPosition = calculateNewPosition(team.boardPosition, confirmedScore, settings.boardSize);
    const finished = hasTeamFinished(newPosition, settings.boardSize);
    const clampedPosition = finished ? settings.boardSize : newPosition;

    const path: number[] = [];
    for (let i = team.boardPosition + 1; i <= clampedPosition; i++) {
      path.push(Math.min(i, settings.boardSize - 1));
    }

    const turnRecord: TurnRecord = {
      teamId: liveTurn.teamId,
      playerId: liveTurn.playerId,
      category: liveTurn.category,
      startPosition: liveTurn.startPosition,
      cardResults: liveTurn.cardResults,
      confirmedScore,
      endPosition: clampedPosition,
    };

    const updatedTeams = teams.map((t, i) => {
      if (i === currentTeamIndex) {
        return {
          ...t,
          boardPosition: clampedPosition,
          currentDescriberIndex: (t.currentDescriberIndex + 1) % t.playerIds.length,
        };
      }
      return t;
    });

    let newFinishedIds = [...finishedTeamIds];
    let newRedemptionMode = redemptionMode;
    let newRedemptionTurns = redemptionTurnsRemaining;
    let newWinnerId: string | null = null;

    if (finished) {
      newFinishedIds.push(team.id);

      if (playingForPlacements) {
        // Playing for placements — check if only 1 unfinished team remains
        const unfinishedCount = updatedTeams.filter((t) => !newFinishedIds.includes(t.id)).length;
        if (unfinishedCount <= 1) {
          // Last team gets last place automatically
          const lastTeam = updatedTeams.find((t) => !newFinishedIds.includes(t.id));
          if (lastTeam) newFinishedIds.push(lastTeam.id);
          newWinnerId = newFinishedIds[0];
        }
      } else if (!redemptionMode) {
        // First team to finish — start redemption round
        newRedemptionMode = true;
        newRedemptionTurns = updatedTeams.filter((t) => !newFinishedIds.includes(t.id)).length;
      } else {
        // During redemption, this team also finished
        newRedemptionTurns--;
      }
    } else if (redemptionMode) {
      // During redemption, this team didn't finish
      newRedemptionTurns--;
    }

    // Check if redemption round is over
    let nextPhase: GamePhase;
    if (newRedemptionMode && newRedemptionTurns <= 0 && !playingForPlacements) {
      // Redemption round complete — show results
      nextPhase = 'redemption_result';
      newWinnerId = newFinishedIds[0];
    } else if (newWinnerId && playingForPlacements) {
      // All teams placed
      nextPhase = confirmedScore > 0 ? 'piece_moving' : 'game_over';
    } else {
      nextPhase = confirmedScore > 0 ? 'piece_moving' : 'turn_intro';
    }

    // Figure out next team (skip finished teams)
    const nextTeamIndex = confirmedScore > 0
      ? currentTeamIndex
      : getNextActiveTeamIndex(currentTeamIndex, updatedTeams, newFinishedIds);

    set({
      phase: nextPhase,
      teams: updatedTeams,
      turnHistory: [...turnHistory, turnRecord],
      liveTurn: null,
      animatingTeamId: confirmedScore > 0 ? team.id : null,
      animationPath: path,
      winnerTeamId: newWinnerId,
      finishedTeamIds: newFinishedIds,
      redemptionMode: newRedemptionMode,
      redemptionTurnsRemaining: newRedemptionTurns,
      currentTeamIndex: nextTeamIndex,
    });

    get().saveState();
  },

  finishPieceAnimation: () => {
    const {
      winnerTeamId, teams, currentTeamIndex, finishedTeamIds,
      redemptionMode, redemptionTurnsRemaining, playingForPlacements,
    } = get();

    // All teams have been placed — game fully over
    if (winnerTeamId && playingForPlacements && finishedTeamIds.length >= teams.length) {
      set({ phase: 'game_over', animatingTeamId: null, animationPath: [] });
      get().saveState();
      return;
    }

    // Redemption round just ended after this animation
    if (redemptionMode && redemptionTurnsRemaining <= 0 && !playingForPlacements) {
      set({ phase: 'redemption_result', animatingTeamId: null, animationPath: [] });
      get().saveState();
      return;
    }

    // Normal flow or continuing play
    const nextTeamIndex = getNextActiveTeamIndex(currentTeamIndex, teams, finishedTeamIds);
    set({
      phase: 'turn_intro',
      currentTeamIndex: nextTeamIndex,
      animatingTeamId: null,
      animationPath: [],
    });

    get().saveState();
  },

  togglePause: () => set({ isPaused: !get().isPaused }),

  // ── Redemption & placements ───────────────────────────────────

  continueForPlacements: () => {
    const { teams, finishedTeamIds } = get();
    // Find the first unfinished team to start with
    const firstUnfinished = teams.findIndex((t) => !finishedTeamIds.includes(t.id));
    set({
      phase: 'turn_intro',
      playingForPlacements: true,
      redemptionMode: false,
      redemptionTurnsRemaining: 0,
      currentTeamIndex: firstUnfinished >= 0 ? firstUnfinished : 0,
    });
  },

  // ── Persistence ────────────────────────────────────────────────

  saveState: () => {
    const s = get();
    storage.set('saved_game', {
      phase: s.phase,
      players: s.players,
      teams: s.teams,
      settings: s.settings,
      boardSpaces: s.boardSpaces,
      deck: s.deck,
      currentTeamIndex: s.currentTeamIndex,
      turnHistory: s.turnHistory,
      winnerTeamId: s.winnerTeamId,
      finishedTeamIds: s.finishedTeamIds,
      redemptionMode: s.redemptionMode,
      redemptionTurnsRemaining: s.redemptionTurnsRemaining,
      playingForPlacements: s.playingForPlacements,
    });
  },

  loadSavedGame: () => {
    const saved = storage.get<any>('saved_game', null);
    if (!saved) return false;
    try {
      set({
        phase: saved.phase,
        players: saved.players,
        teams: saved.teams,
        settings: saved.settings,
        boardSpaces: saved.boardSpaces || generateBoard(saved.settings?.boardSize || 36),
        deck: {
          shuffledCardIds: saved.deck?.shuffledCardIds || [],
          cursor: saved.deck?.cursor || 0,
          seenWords: saved.deck?.seenWords || [],
        },
        currentTeamIndex: saved.currentTeamIndex,
        turnHistory: saved.turnHistory || [],
        winnerTeamId: saved.winnerTeamId || null,
        finishedTeamIds: saved.finishedTeamIds || [],
        redemptionMode: saved.redemptionMode || false,
        redemptionTurnsRemaining: saved.redemptionTurnsRemaining || 0,
        playingForPlacements: saved.playingForPlacements || false,
        liveTurn: null,
        animatingTeamId: null,
        animationPath: [],
      });
      const phase = saved.phase;
      if (phase === 'playing' || phase === 'turn_review' || phase === 'piece_moving' || phase === 'redemption_result') {
        set({ phase: 'turn_intro' });
      }
      return true;
    } catch {
      return false;
    }
  },

  clearSavedGame: () => { storage.remove('saved_game'); },

  resetGame: () => {
    set({
      phase: 'home',
      players: [],
      teams: [],
      settings: { ...DEFAULT_SETTINGS },
      boardSpaces: generateBoard(DEFAULT_SETTINGS.boardSize),
      deck: { shuffledCardIds: [], cursor: 0, seenWords: [] },
      currentTeamIndex: 0,
      turnHistory: [],
      liveTurn: null,
      isPaused: false,
      animatingTeamId: null,
      animationPath: [],
      winnerTeamId: null,
      activeCards: allCards,
      activeCardMap: cardMap,
      isLoadingCustomWords: false,
      finishedTeamIds: [],
      redemptionMode: false,
      redemptionTurnsRemaining: 0,
      playingForPlacements: false,
    });
    storage.remove('saved_game');
  },

  goHome: () => {
    set({
      phase: 'home',
      players: [],
      teams: [],
      settings: { ...DEFAULT_SETTINGS },
      boardSpaces: generateBoard(DEFAULT_SETTINGS.boardSize),
      deck: { shuffledCardIds: [], cursor: 0, seenWords: [] },
      currentTeamIndex: 0,
      turnHistory: [],
      liveTurn: null,
      isPaused: false,
      animatingTeamId: null,
      animationPath: [],
      winnerTeamId: null,
      activeCards: allCards,
      activeCardMap: cardMap,
      isLoadingCustomWords: false,
      finishedTeamIds: [],
      redemptionMode: false,
      redemptionTurnsRemaining: 0,
      playingForPlacements: false,
    });
  },

  reshuffleDeck: () => {
    const { settings, activeCards } = get();
    const deck = createDeck(activeCards, settings.difficulty);
    set({ deck });
    get().saveState();
  },
}));
