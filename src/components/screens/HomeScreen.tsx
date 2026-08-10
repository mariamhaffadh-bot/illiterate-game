import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { storage } from '../../utils';

export function HomeScreen() {
  const setPhase = useGameStore((s) => s.setPhase);
  const loadSavedGame = useGameStore((s) => s.loadSavedGame);
  const hasSavedGame = storage.get('saved_game', null) !== null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-8"
    >
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-6xl sm:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white"
        >
          Illi
          <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">
            terate
          </span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto"
        >
          The board game where you describe, guess, and race to the finish.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <Button size="xl" onClick={() => setPhase('player_setup')} className="w-full">
          New Game
        </Button>
        {hasSavedGame && (
          <Button variant="secondary" size="lg" onClick={() => loadSavedGame()} className="w-full">
            Resume Game
          </Button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-gray-400 dark:text-gray-500 mt-4"
      >
        3+ players · Pass the device · Race around the board
      </motion.div>
    </motion.div>
  );
}
