import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { TEAM_COLORS, GAME_PIECES } from '../../types';

export function RedemptionResult() {
  const teams = useGameStore((s) => s.teams);
  const players = useGameStore((s) => s.players);
  const finishedTeamIds = useGameStore((s) => s.finishedTeamIds);
  const setPhase = useGameStore((s) => s.setPhase);
  const continueForPlacements = useGameStore((s) => s.continueForPlacements);
  const resetGame = useGameStore((s) => s.resetGame);

  const isDraw = finishedTeamIds.length > 1;
  const unfinishedTeams = teams.filter((t) => !finishedTeamIds.includes(t.id));
  const canContinue = teams.length > 2 && unfinishedTeams.length > 0;

  const drawnTeams = isDraw
    ? teams.filter((t) => finishedTeamIds.includes(t.id))
    : [];
  const winnerTeam = !isDraw
    ? teams.find((t) => t.id === finishedTeamIds[0])
    : null;
  const winnerIdx = winnerTeam ? teams.indexOf(winnerTeam) : 0;
  const winnerColor = TEAM_COLORS[winnerIdx % TEAM_COLORS.length];
  const winnerPiece = winnerTeam
    ? GAME_PIECES.find((p) => p.id === winnerTeam.pieceId)
    : null;

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
        {isDraw ? (
          <>
            {/* Draw result */}
            <div className="space-y-3">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-6xl"
              >
                🤝
              </motion.div>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white"
              >
                It's a Draw!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-500 dark:text-gray-400"
              >
                These teams all crossed the finish line
              </motion.p>
            </div>

            {/* Drawn teams */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              {drawnTeams.map((team) => {
                const tIdx = teams.indexOf(team);
                const tc = TEAM_COLORS[tIdx % TEAM_COLORS.length];
                const piece = GAME_PIECES.find((p) => p.id === team.pieceId);
                return (
                  <div
                    key={team.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-2 border-amber-200 dark:border-amber-800"
                  >
                    <span className="text-2xl w-10 text-center">🏆</span>
                    <span className="text-xl">{piece?.emoji}</span>
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tc.bg }} />
                    <div className="flex-1 text-left">
                      <p className="font-bold text-gray-900 dark:text-white">{team.name}</p>
                      <p className="text-xs text-gray-400">
                        {team.playerIds
                          .map((pid) => players.find((p) => p.id === pid)?.name)
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </>
        ) : (
          <>
            {/* Solo winner */}
            <div className="space-y-3">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-6xl"
              >
                🏆
              </motion.div>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl sm:text-5xl font-extrabold"
                style={{ color: winnerColor.bg }}
              >
                {winnerPiece?.emoji} {winnerTeam?.name ?? 'Winner'} Wins!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-500 dark:text-gray-400"
              >
                No other team crossed the finish line during redemption
              </motion.p>
            </div>
          </>
        )}

        {/* Standings of all teams */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-2"
        >
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">All Teams</p>
          {[...teams]
            .sort((a, b) => b.boardPosition - a.boardPosition)
            .map((team) => {
              const tIdx = teams.indexOf(team);
              const tc = TEAM_COLORS[tIdx % TEAM_COLORS.length];
              const piece = GAME_PIECES.find((p) => p.id === team.pieceId);
              const isFinished = finishedTeamIds.includes(team.id);
              return (
                <div
                  key={team.id}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    isFinished
                      ? 'bg-emerald-50 dark:bg-emerald-950/20'
                      : 'bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <span className="text-lg">{piece?.emoji}</span>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tc.bg }} />
                  <span className="flex-1 text-left font-medium text-gray-900 dark:text-white text-sm">
                    {team.name}
                  </span>
                  <span className="text-sm font-bold text-gray-500 tabular-nums">
                    {isFinished ? 'Finished' : `Space ${team.boardPosition}`}
                  </span>
                </div>
              );
            })}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="space-y-3 pt-4"
        >
          {canContinue && (
            <>
              <p className="text-sm text-gray-400">
                {unfinishedTeams.length} team{unfinishedTeams.length > 1 ? 's' : ''} still playing — continue to determine placements?
              </p>
              <Button size="xl" onClick={continueForPlacements} className="w-full">
                Continue for Placements
              </Button>
            </>
          )}
          <Button
            variant={canContinue ? 'secondary' : 'primary'}
            size={canContinue ? 'lg' : 'xl'}
            onClick={() => setPhase('game_over')}
            className="w-full"
          >
            End Game
          </Button>
          <Button variant="ghost" size="md" onClick={resetGame} className="w-full">
            New Game
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
