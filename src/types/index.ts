// ── Board Categories ──────────────────────────────────────────────

/** The 6 word categories that appear on every card */
export const BASE_CATEGORIES = ['ACTION', 'OBJECT', 'NATURE', 'RANDOM', 'PERSON', 'WORLD'] as const;
export type BaseCategory = (typeof BASE_CATEGORIES)[number];

/** All 7 board space categories (6 word categories + SPADE) */
export const BOARD_CATEGORIES = ['ACTION', 'OBJECT', 'NATURE', 'RANDOM', 'PERSON', 'WORLD', 'SPADE'] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];

export const CATEGORY_META: Record<BoardCategory, { label: string; color: string; bg: string; light: string; dark: string; icon: string }> = {
  ACTION:  { label: 'Action',  color: '#E74C3C', bg: '#C0392B', light: '#FADBD8', dark: '#7B241C', icon: '🎬' },
  OBJECT:  { label: 'Object',  color: '#5DADE2', bg: '#2471A3', light: '#D4E6F1', dark: '#1A5276', icon: '🔧' },
  NATURE:  { label: 'Nature',  color: '#2ECC71', bg: '#1E8449', light: '#D5F5E3', dark: '#145A32', icon: '🌿' },
  RANDOM:  { label: 'Random',  color: '#AF7AC5', bg: '#7D3C98', light: '#E8DAEF', dark: '#512E5F', icon: '🎲' },
  PERSON:  { label: 'Person',  color: '#F4D03F', bg: '#D4A017', light: '#FEF9E7', dark: '#9A7D0A', icon: '👤' },
  WORLD:   { label: 'World',   color: '#1ABC9C', bg: '#117A65', light: '#D1F2EB', dark: '#0B5345', icon: '🌍' },
  SPADE:   { label: 'Spade',   color: '#5D6D7E', bg: '#1A5276', light: '#D6DBDF', dark: '#0E2F44', icon: '♠️' },
};

// ── Board Spaces ─────────────────────────────────────────────────

export type BoardSpaceType = 'NORMAL' | 'START' | 'CONTROL' | 'BONUS' | 'SPECIAL';

export interface BoardSpace {
  index: number;
  category: BoardCategory;
  type: BoardSpaceType;
}

// ── Difficulty ───────────────────────────────────────────────────

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type DifficultySelection = Difficulty | 'mixed';

export const DIFFICULTY_META: Record<DifficultySelection, { label: string; description: string }> = {
  easy:   { label: 'Easy',   description: 'Casual and recognizable words. Great for families and new players.' },
  normal: { label: 'Normal', description: 'Balanced mix of common and moderately challenging terms.' },
  hard:   { label: 'Hard',   description: 'Specific, less obvious concepts for experienced players.' },
  expert: { label: 'Expert', description: 'Very challenging but fair. Requires broad knowledge.' },
  mixed:  { label: 'Mixed',  description: 'Dynamic mix of all difficulties. Expect surprises.' },
};

/** Distribution for "mixed" mode */
export const MIXED_DISTRIBUTION: Record<Difficulty, number> = {
  easy: 0.20,
  normal: 0.50,
  hard: 0.25,
  expert: 0.05,
};

// ── Cards ────────────────────────────────────────────────────────

export interface Card {
  id: string;
  action: string;
  object: string;
  nature: string;
  random: string;
  person: string;
  world: string;
  difficulty: Difficulty;
  isSpade: boolean;
  /** Which of the 6 base categories the ♠ symbol sits next to on this card */
  spadeCategory: BaseCategory;
}

// ── Deck ─────────────────────────────────────────────────────────

export interface DeckState {
  shuffledCardIds: string[];
  cursor: number;
  seenWords: string[]; // normalized words already visible this game
}

// ── Game Pieces ──────────────────────────────────────────────────

export interface GamePieceOption {
  id: string;
  emoji: string;
  name: string;
}

export const GAME_PIECES: GamePieceOption[] = [
  { id: 'rocket',    emoji: '🚀', name: 'Rocket' },
  { id: 'crown',     emoji: '👑', name: 'Crown' },
  { id: 'bolt',      emoji: '⚡', name: 'Lightning' },
  { id: 'star',      emoji: '⭐', name: 'Star' },
  { id: 'diamond',   emoji: '💎', name: 'Diamond' },
  { id: 'ghost',     emoji: '👻', name: 'Ghost' },
  { id: 'flame',     emoji: '🔥', name: 'Flame' },
  { id: 'planet',    emoji: '🪐', name: 'Planet' },
  { id: 'car',       emoji: '🏎️', name: 'Race Car' },
  { id: 'knight',    emoji: '♞',  name: 'Knight' },
  { id: 'trophy',    emoji: '🏆', name: 'Trophy' },
  { id: 'gem',       emoji: '💠', name: 'Gem' },
  { id: 'unicorn',   emoji: '🦄', name: 'Unicorn' },
  { id: 'dice',      emoji: '🎲', name: 'Dice' },
  { id: 'anchor',    emoji: '⚓', name: 'Anchor' },
  { id: 'moon',      emoji: '🌙', name: 'Moon' },
];

// ── Players & Teams ──────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
  pieceId: string;
  boardPosition: number;
  currentDescriberIndex: number;
}

// ── Turn ─────────────────────────────────────────────────────────

export interface TurnCardResult {
  cardId: string;
  word: string;
  markedCorrect: boolean;
  confirmedCorrect: boolean;
  isSpade: boolean;
}

export interface TurnRecord {
  teamId: string;
  playerId: string;
  category: BoardCategory;
  startPosition: number;
  cardResults: TurnCardResult[];
  confirmedScore: number;
  endPosition: number;
}

// ── Game Phases ──────────────────────────────────────────────────

export type GamePhase =
  | 'home'
  | 'player_setup'
  | 'team_setup'
  | 'game_settings'
  | 'turn_intro'
  | 'playing'
  | 'turn_review'
  | 'piece_moving'
  | 'game_over'
  | 'redemption_result';

// ── Settings ─────────────────────────────────────────────────────

export interface GameSettings {
  timerDuration: number;
  soundEnabled: boolean;
  boardSize: number;
  difficulty: DifficultySelection;
  useCustomCategories: boolean;
  customCategoryNames: string[]; // maps by index to BASE_CATEGORIES slots
}

export const DEFAULT_SETTINGS: GameSettings = {
  timerDuration: 60,
  soundEnabled: true,
  boardSize: 42, // 6 full cycles of 7 categories
  difficulty: 'normal',
  useCustomCategories: false,
  customCategoryNames: [],
};

/**
 * Get the display label for a board category, respecting custom mode.
 */
export function getCategoryLabel(category: BoardCategory, settings: GameSettings): string {
  if (!settings.useCustomCategories || category === 'SPADE') {
    return CATEGORY_META[category].label;
  }
  const idx = (BASE_CATEGORIES as readonly string[]).indexOf(category);
  if (idx !== -1 && settings.customCategoryNames[idx]) {
    return settings.customCategoryNames[idx];
  }
  return CATEGORY_META[category].label;
}

/**
 * Get the active base categories (for custom mode, only the ones with names).
 */
export function getActiveBaseCategories(settings: GameSettings): BaseCategory[] {
  if (!settings.useCustomCategories || settings.customCategoryNames.length === 0) {
    return [...BASE_CATEGORIES];
  }
  return BASE_CATEGORIES.slice(0, settings.customCategoryNames.length) as unknown as BaseCategory[];
}

/**
 * Get the active board categories including SPADE.
 */
export function getActiveBoardCategories(settings: GameSettings): BoardCategory[] {
  const base = getActiveBaseCategories(settings);
  return [...base, 'SPADE'] as BoardCategory[];
}

// ── Team Colors ──────────────────────────────────────────────────

export const TEAM_COLORS = [
  { name: 'Red',    bg: '#EF4444', light: '#FEE2E2', text: '#991B1B', mid: '#FCA5A5' },
  { name: 'Blue',   bg: '#3B82F6', light: '#DBEAFE', text: '#1E3A8A', mid: '#93C5FD' },
  { name: 'Green',  bg: '#22C55E', light: '#DCFCE7', text: '#14532D', mid: '#86EFAC' },
  { name: 'Purple', bg: '#A855F7', light: '#F3E8FF', text: '#581C87', mid: '#C4B5FD' },
  { name: 'Orange', bg: '#F97316', light: '#FFEDD5', text: '#7C2D12', mid: '#FDBA74' },
  { name: 'Teal',   bg: '#14B8A6', light: '#CCFBF1', text: '#134E4A', mid: '#5EEAD4' },
  { name: 'Pink',   bg: '#EC4899', light: '#FCE7F3', text: '#831843', mid: '#F9A8D4' },
  { name: 'Yellow', bg: '#EAB308', light: '#FEF9C3', text: '#713F12', mid: '#FDE047' },
];

export const PLAYER_COLORS = [
  '#EF4444', '#3B82F6', '#22C55E', '#A855F7',
  '#F97316', '#14B8A6', '#EC4899', '#EAB308',
  '#6366F1', '#06B6D4', '#F43F5E', '#84CC16',
];
