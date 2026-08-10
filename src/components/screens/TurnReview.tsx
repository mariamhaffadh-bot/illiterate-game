import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { TEAM_COLORS, CATEGORY_META, GAME_PIECES, getCategoryLabel } from '../../types';
import { getCurrentDescriber } from '../../engine/game';

export function TurnReview() {
  const teams = useGameStore((s) => s.teams);
  const players = useGameStore((s) => s.players);
  const currentTeamIndex = useGameStore((s) => s.currentTeamIndex);
  const liveTurn = useGameStore((s) => s.liveTurn);
  const toggleReviewItem = useGameStore((s) => s.toggleReviewItem);
  const confirmScore = useGameStore((s) => s.confirmScore);
  const settings = useGameStore((s) => s.settings);

  if (!liveTurn) return null;

  const team = teams[currentTeamIndex];
  const describer = getCurrentDescriber(team, players);
  const tc = TEAM_COLORS[currentTeamIndex % TEAM_COLORS.length];
  const catMeta = CATEGORY_META[liveTurn.category];
  const piece = GAME_PIECES.find((p) => p.id === team.pieceId);
  const confirmedScore = liveTurn.cardResults.filter((c) => c.confirmedCorrect).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-6 w-full"
      >
        {/* Header */}
        <div>
          <p className="text-sm text-gray-400 uppercase tracking-wider font-medium mb-2">
            Round Complete
          </p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Review & Confirm
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-lg">{piece?.emoji}</span>
            <span className="font-semibold" style={{ color: tc.bg }}>{team.name}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{describer?.name}</span>
            <span className="text-gray-400">·</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: catMeta.bg }}>
              {getCategoryLabel(liveTurn.category, settings)}
            </span>
          </div>
        </div>

        {/* Score display */}
        <div className="py-4">
          <p className="text-sm text-gray-400 mb-1">Confirmed spaces to move</p>
          <motion.span
            key={confirmedScore}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-6xl font-extrabold tabular-nums"
            style={{ color: tc.bg }}
          >
            {confirmedScore}
          </motion.span>
        </div>

        {/* Card results - toggleable */}
        {liveTurn.cardResults.length > 0 ? (
          <div className="space-y-2 text-left">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium text-center mb-3">
              Tap to correct any mistakes
            </p>
            {liveTurn.cardResults.map((result, i) => (
              <motion.button
                key={`${result.cardId}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => toggleReviewItem(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer border-2 ${
                  result.confirmedCorrect
                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    result.confirmedCorrect
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {result.confirmedCorrect ? '✓' : '✕'}
                </div>
                <span
                  className={`text-base font-medium flex-1 text-left ${
                    result.confirmedCorrect
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 line-through'
                  }`}
                >
                  {result.word}
                  {result.isSpade && (
                    <span className="ml-1.5 text-xs text-gray-400">♠</span>
                  )}
                </span>
              </motion.button>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 italic">No cards were attempted this turn</p>
        )}

        {/* Confirm button */}
        <div className="pt-6">
          <Button size="xl" onClick={confirmScore} color={tc.bg} className="w-full">
            {confirmedScore > 0
              ? `Confirm — Move ${confirmedScore} Space${confirmedScore !== 1 ? 's' : ''}`
              : 'Confirm — No Movement'}
          </Button>
          <p className="text-xs text-gray-400 mt-2">
            Score is final after confirmation
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
