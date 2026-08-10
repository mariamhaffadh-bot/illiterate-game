import type { Player, Team, TurnRecord } from '../types';

/**
 * Get the current describer for a team.
 */
export function getCurrentDescriber(
  team: Team,
  players: Player[]
): Player | undefined {
  if (team.playerIds.length === 0) return undefined;
  const playerId = team.playerIds[team.currentDescriberIndex % team.playerIds.length];
  return players.find((p) => p.id === playerId);
}

/**
 * Compute game statistics from turn history.
 */
export function computeStats(
  turnHistory: TurnRecord[],
  teams: Team[],
  players: Player[]
) {
  const totalWords = turnHistory.reduce((sum, t) => sum + t.confirmedScore, 0);
  const totalPasses = turnHistory.reduce(
    (sum, t) => sum + t.cardResults.filter((c) => !c.confirmedCorrect).length,
    0
  );

  // Best round
  let bestRound: TurnRecord | null = null;
  for (const turn of turnHistory) {
    if (!bestRound || turn.confirmedScore > bestRound.confirmedScore) {
      bestRound = turn;
    }
  }

  // Highest-scoring player
  const playerScores = new Map<string, number>();
  for (const turn of turnHistory) {
    playerScores.set(
      turn.playerId,
      (playerScores.get(turn.playerId) ?? 0) + turn.confirmedScore
    );
  }
  let topPlayerId = '';
  let topPlayerScore = 0;
  for (const [pid, score] of playerScores) {
    if (score > topPlayerScore) {
      topPlayerId = pid;
      topPlayerScore = score;
    }
  }

  // Most total cards attempted
  const playerAttempts = new Map<string, number>();
  for (const turn of turnHistory) {
    playerAttempts.set(
      turn.playerId,
      (playerAttempts.get(turn.playerId) ?? 0) + turn.cardResults.length
    );
  }

  // Closest teams
  const sortedTeams = [...teams].sort((a, b) => b.boardPosition - a.boardPosition);
  let closestDiff = Infinity;
  let closestPair: [Team, Team] | null = null;
  for (let i = 0; i < sortedTeams.length - 1; i++) {
    const diff = sortedTeams[i].boardPosition - sortedTeams[i + 1].boardPosition;
    if (diff < closestDiff) {
      closestDiff = diff;
      closestPair = [sortedTeams[i], sortedTeams[i + 1]];
    }
  }

  const bestRoundPlayer = players.find((p) => p.id === bestRound?.playerId);
  const bestRoundTeam = teams.find((t) => t.id === bestRound?.teamId);
  const topPlayer = players.find((p) => p.id === topPlayerId);

  return {
    totalWords,
    totalPasses,
    totalTurns: turnHistory.length,
    bestRound: bestRound
      ? {
          playerName: bestRoundPlayer?.name ?? 'Unknown',
          teamName: bestRoundTeam?.name ?? 'Unknown',
          score: bestRound.confirmedScore,
        }
      : null,
    topScorer: topPlayer
      ? { name: topPlayer.name, score: topPlayerScore }
      : null,
    closestRivalry: closestPair
      ? {
          team1: closestPair[0].name,
          team2: closestPair[1].name,
          difference: closestDiff,
        }
      : null,
  };
}
