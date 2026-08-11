import type { PublicDisplayState, DisplayPhase, PublicTeamInfo } from '../types/display';
import type { GamePhase, Player, Team, BoardSpace, GameSettings, BoardCategory } from '../types';
import { getCategoryLabel } from '../types';
import { getCategoryAtPosition } from '../engine/board';
import { getCurrentDescriber } from '../engine/game';

interface GameStoreSnapshot {
  phase: GamePhase;
  players: Player[];
  teams: Team[];
  settings: GameSettings;
  boardSpaces: BoardSpace[];
  currentTeamIndex: number;
  isPaused: boolean;
  animatingTeamId: string | null;
  animationPath: number[];
  winnerTeamId: string | null;
  finishedTeamIds: string[];
  redemptionMode: boolean;
  playingForPlacements: boolean;
  // Live turn — only non-sensitive fields extracted
  liveTurnCategory: BoardCategory | null;
  liveTurnScore: number;
  confirmedScore: number | null;
  // Timer timestamps
  turnStartedAt: number | null;
  pausedWithRemaining: number | null;
}

function mapPhase(phase: GamePhase): DisplayPhase {
  switch (phase) {
    case 'home':
    case 'player_setup':
    case 'team_setup':
    case 'game_settings':
      return 'waiting';
    case 'turn_intro':
      return 'turn_intro';
    case 'playing':
      return 'playing';
    case 'turn_review':
      return 'turn_review';
    case 'piece_moving':
      return 'piece_moving';
    case 'game_over':
      return 'game_over';
    case 'redemption_result':
      return 'redemption_result';
    default:
      return 'waiting';
  }
}

function buildPublicTeams(teams: Team[], players: Player[]): PublicTeamInfo[] {
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    pieceId: t.pieceId,
    boardPosition: t.boardPosition,
    playerNames: t.playerIds
      .map((pid) => players.find((p) => p.id === pid)?.name ?? 'Unknown')
      .filter(Boolean),
  }));
}

/**
 * Create a display-safe state from the game store.
 * This function intentionally strips ALL card/word/deck data.
 */
export function createPublicDisplayState(
  gameId: string,
  snapshot: GameStoreSnapshot
): PublicDisplayState {
  const {
    phase, players, teams, settings, boardSpaces, currentTeamIndex,
    isPaused, animatingTeamId, animationPath, winnerTeamId,
    finishedTeamIds, redemptionMode, playingForPlacements,
    liveTurnCategory, liveTurnScore, confirmedScore,
    turnStartedAt, pausedWithRemaining,
  } = snapshot;

  const team = teams[currentTeamIndex];
  const describer = team ? getCurrentDescriber(team, players) : undefined;
  const category: BoardCategory = liveTurnCategory ?? getCategoryAtPosition(boardSpaces, team?.boardPosition ?? 0);
  const isSpadeTurn = category === 'SPADE';

  return {
    gameId,
    phase: mapPhase(phase),

    boardSpaces,
    settings: {
      boardSize: settings.boardSize,
      timerDuration: settings.timerDuration,
      useCustomCategories: settings.useCustomCategories,
      customCategoryNames: settings.customCategoryNames,
    },

    teams: buildPublicTeams(teams, players),
    activeTeamId: team?.id ?? '',
    activePlayerName: describer?.name ?? 'Unknown',

    currentCategory: category,
    currentCategoryLabel: isSpadeTurn ? 'Spade' : getCategoryLabel(category, settings),
    isSpadeTurn,

    turnStartedAt,
    turnDuration: settings.timerDuration,
    isPaused,
    pausedWithRemaining,

    turnScore: liveTurnScore,
    confirmedScore,

    animatingTeamId,
    animationPath,

    winnerTeamId,
    finishedTeamIds,
    isDraw: finishedTeamIds.length > 1,

    redemptionMode,
    playingForPlacements,
  };
}
