import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

export function ModeSelect() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);

  // Check for ?room= URL param
  const urlRoom = new URLSearchParams(window.location.search).get('room');

  if (urlRoom) {
    // Auto-redirect to join flow
    setMultiplayerMode('player');
    setPhase('multiplayer_lobby');
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-8"
    >
      {/* Title */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-6xl sm:text-7xl font-game-title tracking-tight text-gray-900 dark:text-white"
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
          className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto font-game-ui"
        >
          How do you want to play?
        </motion.p>
      </div>

      {/* Mode cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-4 w-full max-w-lg"
      >
        {/* Pass & Play */}
        <button
          onClick={() => {
            setMultiplayerMode(null);
            setPhase('home');
          }}
          className="flex-1 p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-500 transition-all cursor-pointer text-left group hover:shadow-lg"
        >
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-game-ui mb-1">
            Pass & Play
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-game-ui">
            One device, passed around the group
          </p>
        </button>

        {/* Multiplayer */}
        <button
          onClick={() => {
            setMultiplayerMode('host');
            setPhase('home');
          }}
          className="flex-1 p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-pink-400 dark:hover:border-pink-500 transition-all cursor-pointer text-left group hover:shadow-lg"
        >
          <div className="text-4xl mb-3">📱</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-game-ui mb-1">
            Multiplayer
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-game-ui mb-3">
            Each player on their own device
          </p>
          <div className="flex gap-2">
            <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
              Host a game
            </span>
          </div>
        </button>
      </motion.div>

      {/* Join with code */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <button
          onClick={() => {
            setMultiplayerMode('player');
            setPhase('multiplayer_lobby');
          }}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 cursor-pointer transition-colors font-game-ui underline underline-offset-4"
        >
          Have a room code? Join a game
        </button>
      </motion.div>
    </motion.div>
  );
}
