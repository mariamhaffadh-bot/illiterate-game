import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { TEAM_COLORS, GAME_PIECES } from '../../types';
import { computeStats } from '../../engine/game';

const MEDALS = ['🥇', '🥈', '🥉'];

export function GameOver() {
  const teams = useGameStore((s) => s.teams);
  const players = useGameStore((s) => s.players);
  const turnHistory = useGameStore((s) => s.turnHistory);
  const finishedTeamIds = useGameStore((s) => s.finishedTeamIds);
  const resetGame = useGameStore((s) => s.resetGame);
  const startGame = useGameStore((s) => s.startGame);
  const setPhase = useGameStore((s) => s.setPhase);
  const clearSavedGame = useGameStore((s) => s.clearSavedGame);

  const stats = computeStats(turnHistory, teams, players);

  // Build placement order: finished teams in order, then unfinished by position
  const finishedSet = new Set(finishedTeamIds);
  const unfinished = [...teams]
    .filter((t) => !finishedSet.has(t.id))
    .sort((a, b) => b.boardPosition - a.boardPosition);
  const sortedTeams = [
    ...finishedTeamIds.map((id) => teams.find((t) => t.id === id)!).filter(Boolean),
    ...unfinished,
  ];

  // Check for draw (multiple teams finished during redemption = tied for 1st)
  const isDraw = finishedTeamIds.length > 1;
  const firstFinisher = sortedTeams[0];
  const firstIdx = firstFinisher ? teams.indexOf(firstFinisher) : 0;
  const firstColor = TEAM_COLORS[firstIdx % TEAM_COLORS.length];
  const firstPiece = firstFinisher ? GAME_PIECES.find((p) => p.id === firstFinisher.pieceId) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center space-y-8 w-full"
      >
        {/* Header */}
        <div className="space-y-3">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-6xl"
          >
            {isDraw ? '🤝' : '🏆'}
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl sm:text-5xl font-extrabold"
            style={{ color: isDraw ? undefined : firstColor.bg }}
          >
            {isDraw
              ? 'Draw!'
              : `${firstPiece?.emoji} ${firstFinisher?.name ?? 'Winner'} Wins!`}
          </motion.h1>
        </div>

        {/* Final standings */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          {sortedTeams.map((team, i) => {
            const tIdx = teams.indexOf(team);
            const tc = TEAM_COLORS[tIdx % TEAM_COLORS.length];
            const piece = GAME_PIECES.find((p) => p.id === team.pieceId);
            const isFinished = finishedSet.has(team.id);

            // For draw, all finished teams share 1st place
            let medal = '';
            if (isDraw && isFinished) {
              medal = '🏆';
            } else if (!isDraw) {
              medal = i < MEDALS.length ? MEDALS[i] : '';
            } else {
              // Unfinished teams in a draw get medals starting from the position after drawn teams
              const unfinishedIdx = i - finishedTeamIds.length;
              const medalIdx = finishedTeamIds.length + unfinishedIdx;
              medal = medalIdx < MEDALS.length ? MEDALS[medalIdx] : '';
            }

            return (
              <motion.div
                key={team.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-2xl ${
                  (isDraw && isFinished) || (!isDraw && i === 0)
                    ? 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-2 border-amber-200 dark:border-amber-800'
                    : 'bg-gray-50 dark:bg-gray-800/50'
                }`}
              >
                <span className="text-2xl w-10 text-center">{medal}</span>
                <span className="text-xl">{piece?.emoji}</span>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tc.bg }} />
                <div className="flex-1 text-left">
                  <p className="font-bold text-gray-900 dark:text-white">{team.name}</p>
                  <p className="text-xs text-gray-400">
                    {team.playerIds.map((pid) => players.find((p) => p.id === pid)?.name).filter(Boolean).join(', ')}
                  </p>
                </div>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">
                  {isFinished ? 'Finished' : `Space ${team.boardPosition}`}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="grid grid-cols-2 gap-3"
        >
          {stats.totalWords > 0 && <StatCard label="Total Words Guessed" value={String(stats.totalWords)} />}
          {stats.totalTurns > 0 && <StatCard label="Total Turns" value={String(stats.totalTurns)} />}
          {stats.bestRound && (
            <StatCard label="Best Round" value={`${stats.bestRound.score} pts`} sub={stats.bestRound.playerName} />
          )}
          {stats.topScorer && (
            <StatCard label="Top Scorer" value={stats.topScorer.name} sub={`${stats.topScorer.score} pts total`} />
          )}
          {stats.closestRivalry && stats.closestRivalry.difference <= 5 && (
            <StatCard
              label="Closest Rivalry"
              value={`${stats.closestRivalry.difference} space gap`}
              sub={`${stats.closestRivalry.team1} vs ${stats.closestRivalry.team2}`}
            />
          )}
          {stats.totalPasses > 0 && <StatCard label="Total Passes" value={String(stats.totalPasses)} />}
        </motion.div>

        {/* Actions */}
        <RematchActions
          onSameTeams={() => { clearSavedGame(); startGame(); }}
          onChangeTeams={() => { clearSavedGame(); setPhase('team_setup'); }}
          onNewGame={resetGame}
        />
      </motion.div>
    </motion.div>
  );
}

function RematchActions({
  onSameTeams,
  onChangeTeams,
  onNewGame,
}: {
  onSameTeams: () => void;
  onChangeTeams: () => void;
  onNewGame: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="space-y-3 pt-4">
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.div key="main" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <Button size="xl" onClick={() => setExpanded(true)} className="w-full">
              Rematch
            </Button>
            <Button variant="ghost" size="md" onClick={onNewGame} className="w-full">
              New Game
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="choices"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-sm text-gray-400 text-center">How do you want to rematch?</p>
            <Button size="lg" onClick={onSameTeams} className="w-full">
              Keep Same Teams
            </Button>
            <Button variant="secondary" size="lg" onClick={onChangeTeams} className="w-full">
              Change Teams
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="w-full">
              ← Back
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
