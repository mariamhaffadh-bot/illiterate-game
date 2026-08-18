import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { storage } from '../../utils';
import { clearAll as clearWordBank } from '../../utils/wordBank';
import { QRCodeSVG } from 'qrcode.react';

export function HomeScreen() {
  const setPhase = useGameStore((s) => s.setPhase);
  const loadSavedGame = useGameStore((s) => s.loadSavedGame);
  const savedGame = storage.get<any>('saved_game', null);
  const hasSavedGame = savedGame !== null;
  const savedGameId = savedGame?.gameId ?? null;
  const [copied, setCopied] = useState(false);

  const displayUrl = savedGameId
    ? `${window.location.origin}/#/display/${savedGameId}`
    : null;

  const copyLink = () => {
    if (!displayUrl) return;
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

      {/* Board Display link for saved games with a game ID */}
      {savedGameId && displayUrl && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-xs"
        >
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
              Board Display
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Open on a TV or second screen to show the board live
            </p>

            {/* QR Code */}
            <div className="flex justify-center py-2">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={displayUrl} size={120} level="M" bgColor="#fff" fgColor="#111827" />
              </div>
            </div>

            {/* Game code */}
            <p className="text-center text-2xl font-black tracking-widest text-gray-900 dark:text-white">
              {savedGameId}
            </p>

            <div className="flex gap-2">
              <a
                href={`/#/display/${savedGameId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium text-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Open Board
              </a>
              <button
                onClick={copyLink}
                className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center space-y-2 mt-4"
      >
        <p className="text-sm text-gray-400 dark:text-gray-500">
          3+ players · Pass the device · Race around the board
        </p>
        <button
          onClick={() => { clearWordBank(); alert('Word history cleared! All words are fresh now.'); }}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 cursor-pointer transition-colors underline underline-offset-4"
        >
          Reset Word History
        </button>
      </motion.div>
    </motion.div>
  );
}
