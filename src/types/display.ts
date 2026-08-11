import type { BoardSpace, GameSettings } from './index';

/** Team info safe for public display — no card/word data */
export interface PublicTeamInfo {
  id: string;
  name: string;
  color: string;
  pieceId: string;
  boardPosition: number;
  playerNames: string[];
}

/** Display phase — mapped from GamePhase but display-specific */
export type DisplayPhase =
  | 'waiting'       // No game state yet
  | 'turn_intro'    // About to start a turn
  | 'playing'       // Timer running
  | 'turn_review'   // Scoring review (no words shown)
  | 'piece_moving'  // Piece animation
  | 'game_over'     // Final results
  | 'redemption_result'; // Redemption outcome

/**
 * The ONLY state shape sent to display clients.
 * Must NEVER contain: currentCard, words, deck, seenWords, cardResults, or any card content.
 */
export interface PublicDisplayState {
  gameId: string;
  phase: DisplayPhase;

  // Board
  boardSpaces: BoardSpace[];
  settings: Pick<GameSettings, 'boardSize' | 'timerDuration' | 'useCustomCategories' | 'customCategoryNames'>;

  // Teams
  teams: PublicTeamInfo[];
  activeTeamId: string;
  activePlayerName: string;

  // Turn info (no words!)
  currentCategory: string;
  currentCategoryLabel: string;
  isSpadeTurn: boolean;

  // Timer — timestamp-based to avoid drift
  turnStartedAt: number | null;
  turnDuration: number;
  isPaused: boolean;
  pausedWithRemaining: number | null;

  // Scores
  turnScore: number;
  confirmedScore: number | null;

  // Animation
  animatingTeamId: string | null;
  animationPath: number[];

  // Game end
  winnerTeamId: string | null;
  finishedTeamIds: string[];
  isDraw: boolean;

  // Redemption
  redemptionMode: boolean;
  playingForPlacements: boolean;
}

/** Sensitive keys that must NEVER appear in PublicDisplayState */
export const FORBIDDEN_DISPLAY_KEYS = [
  'currentCard',
  'deck',
  'words',
  'seenWords',
  'turnAnswers',
  'cardResults',
  'liveTurn',
  'activeCards',
  'activeCardMap',
] as const;
