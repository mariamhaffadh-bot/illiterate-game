import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

export function ModeSelect() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);

  // Auto-redirect to join if ?room= in URL
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  if (urlRoom) {
    setMultiplayerMode('player');
    setPhase('multiplayer_lobby');
    return null;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="font-game-title tracking-tight text-gray-900 dark:text-white"
          style={{ fontSize: 'clamp(3rem, 10vw, 4.5rem)' }}>
          Illi<span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">terate</span>
        </motion.div>
        <p className="text-lg text-gray-500 dark:text-gray-400 font-game-ui">How do you want to play?</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-4 w-full" style={{ maxWidth: 520 }}>
        {/* Pass & Play */}
        <button onClick={() => { setMultiplayerMode(null); setPhase('home'); }}
          className="flex-1 p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-500 transition-all cursor-pointer text-left hover:shadow-lg"
          style={{ minHeight: 52 }}>
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-game-ui mb-1">Pass & Play</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-game-ui">One device, passed around</p>
        </button>

        {/* Multiplayer — shows Host / Join choice */}
        <div className="flex-1 flex flex-col gap-3">
          <button onClick={() => { setMultiplayerMode('host'); setPhase('multiplayer_lobby'); }}
            className="flex-1 p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-pink-400 dark:hover:border-pink-500 transition-all cursor-pointer text-left hover:shadow-lg"
            style={{ minHeight: 52 }}>
            <div className="text-4xl mb-3">🎮</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-game-ui mb-1">Host</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-game-ui">Create a new game room</p>
          </button>
          <button onClick={() => { setMultiplayerMode('player'); setPhase('multiplayer_lobby'); }}
            className="flex-1 p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-500 transition-all cursor-pointer text-left hover:shadow-lg"
            style={{ minHeight: 52 }}>
            <div className="text-4xl mb-3">📱</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-game-ui mb-1">Join</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-game-ui">Enter a code to join</p>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
