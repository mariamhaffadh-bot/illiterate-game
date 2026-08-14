import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useTimer } from '../../hooks/useTimer';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useSound } from '../../hooks/useSound';
import { TimerRing } from '../ui/TimerRing';
import { startCountdown, stopCountdown, playTimeUp, ensureAudioReady } from '../../engine/audioEngine';
import { TEAM_COLORS, CATEGORY_META, getActiveBaseCategories, getCategoryLabel } from '../../types';
import type { Card, GameSettings } from '../../types';

function CardDisplay({ card, settings }: { card: Card; settings: GameSettings }) {
  const activeCategories = getActiveBaseCategories(settings);

  const entries = activeCategories.map((cat) => ({
    key: cat,
    label: getCategoryLabel(cat, settings),
    meta: CATEGORY_META[cat],
    word: card[cat.toLowerCase() as 'action' | 'object' | 'nature' | 'random' | 'person' | 'world'],
    hasSpade: card.spadeCategory === cat,
  }));

  return (
    <div className="w-full max-w-sm mx-auto">
      <div
        className="word-card"
        style={{ '--card-accent': CATEGORY_META[entries[0]?.key ?? 'ACTION'].bg } as React.CSSProperties}
      >
        <div className="pt-5 pb-3">
          {entries.map(({ key, label, meta, word, hasSpade }) => (
            <div
              key={key}
              className="flex items-center border-b last:border-b-0"
              style={{ borderColor: 'rgba(0,0,0,0.06)' }}
            >
              {/* Category label */}
              <div className="w-20 sm:w-24 shrink-0 py-3 px-3 text-right">
                <span
                  className="text-[10px] sm:text-xs font-game-category uppercase tracking-wider"
                  style={{ color: meta.bg }}
                >
                  {label}
                </span>
              </div>

              {/* Word */}
              <div className="flex-1 py-3 px-3 sm:px-4 word-text text-base sm:text-lg">
                {word}
              </div>

              {/* Spade symbol */}
              {hasSpade && (
                <div className="pr-3 text-lg font-bold select-none" style={{ color: CATEGORY_META.SPADE.bg }}>
                  ♠
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlayingScreen() {
  const teams = useGameStore((s) => s.teams);
  const currentTeamIndex = useGameStore((s) => s.currentTeamIndex);
  const settings = useGameStore((s) => s.settings);
  const liveTurn = useGameStore((s) => s.liveTurn);
  const markCorrect = useGameStore((s) => s.markCorrect);
  const markPass = useGameStore((s) => s.markPass);
  const endTimer = useGameStore((s) => s.endTimer);
  const isPaused = useGameStore((s) => s.isPaused);
  const togglePause = useGameStore((s) => s.togglePause);

  const { play } = useSound();
  const [flash, setFlash] = useState<'correct' | 'pass' | null>(null);
  const processingRef = useRef(false);

  const team = teams[currentTeamIndex];
  const tc = TEAM_COLORS[currentTeamIndex % TEAM_COLORS.length];
  const category = liveTurn?.category;
  const isSpadeTurn = category === 'SPADE';
  const catMeta = category ? CATEGORY_META[category] : null;
  const catLabel = category ? (isSpadeTurn ? 'Spade' : getCategoryLabel(category, settings)) : '';
  const correctCount = liveTurn?.cardResults.filter((c) => c.markedCorrect).length ?? 0;

  const countdownStartedRef = useRef(false);

  const { remaining, isUrgent, isCritical, start } = useTimer({
    duration: settings.timerDuration,
    onTick: (r) => {
      if (r === 10 && !countdownStartedRef.current) {
        countdownStartedRef.current = true;
        startCountdown(10);
      }
    },
    onComplete: () => {
      stopCountdown();
      playTimeUp();
      endTimer();
    },
    paused: isPaused,
  });

  useEffect(() => { start(); }, [start]);

  // Stop countdown audio if paused
  useEffect(() => {
    if (isPaused) stopCountdown();
    else if (remaining <= 10 && remaining > 0) {
      countdownStartedRef.current = true;
      startCountdown(remaining);
    }
  }, [isPaused]);

  // Cleanup countdown on unmount
  useEffect(() => () => stopCountdown(), []);

  const handleCorrect = () => {
    if (processingRef.current || !liveTurn?.currentCard) return;
    processingRef.current = true;
    ensureAudioReady();
    play('correct');
    setFlash('correct');
    markCorrect();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 150);
  };

  const handlePass = () => {
    if (processingRef.current || !liveTurn?.currentCard) return;
    processingRef.current = true;
    ensureAudioReady();
    play('pass');
    setFlash('pass');
    markPass();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 150);
  };

  useKeyboard({
    ' ': handleCorrect,
    Space: handleCorrect,
    p: handlePass,
    P: handlePass,
    Escape: () => togglePause(),
  }, [liveTurn?.currentCard?.id, isPaused]);

  const noWordsLeft = !liveTurn?.currentCard;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`min-h-[100dvh] flex flex-col relative overflow-hidden transition-colors duration-300 ${
        isCritical ? 'bg-red-50 dark:bg-red-950/20' : isUrgent ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-900'
      }`}
    >
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`absolute inset-0 z-30 pointer-events-none ${flash === 'correct' ? 'bg-emerald-400' : 'bg-orange-400'}`}
          />
        )}
      </AnimatePresence>

      {/* Pause overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center gap-6">
            <h2 className="text-4xl font-game-title text-white">Paused</h2>
            <button onClick={togglePause} className="px-8 py-4 rounded-2xl bg-white text-gray-900 text-lg font-semibold cursor-pointer">Resume</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between p-3 sm:p-5">
        <div className="flex items-center gap-2">
          <div
            className="category-tile category-tile-raised px-3 py-1.5 text-sm"
            style={{
              background: `linear-gradient(135deg, ${tc.bg}, ${tc.mid || tc.bg})`,
              '--tile-dark': tc.text || '#000',
            } as React.CSSProperties}
          >
            {team.name}
          </div>
          {catMeta && (
            <div
              className="category-tile category-tile-raised px-2.5 py-1 text-xs"
              style={{
                background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`,
                '--tile-dark': catMeta.dark,
              } as React.CSSProperties}
            >
              {isSpadeTurn ? `${catMeta.icon} Spade` : `${catMeta.icon} ${catLabel}`}
            </div>
          )}
          <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums ml-1 font-game-ui">
            {correctCount}
          </span>
        </div>
        <TimerRing remaining={remaining} total={settings.timerDuration} isUrgent={isUrgent} isCritical={isCritical} size={72} />
      </div>

      {/* Spade mode banner */}
      {isSpadeTurn && (
        <div className="text-center px-4 pb-1">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-900 text-white text-sm font-bold dark:bg-white dark:text-gray-900 font-game-ui">
            ♠ ACT IT OUT — Find the spade!
          </span>
        </div>
      )}

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 py-2">
        <AnimatePresence mode="wait">
          {noWordsLeft ? (
            <motion.div key="no-words" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <p className="text-xl text-gray-500 font-game-ui">No more cards!</p>
              <p className="text-sm text-gray-400 mt-2 font-game-ui">Wait for the timer to end</p>
            </motion.div>
          ) : (
            <motion.div
              key={liveTurn?.currentCard?.id}
              initial={{ opacity: 0, x: 60, rotateY: 90 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -60, rotateY: -20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="w-full"
              style={{ perspective: '600px' }}
            >
              {liveTurn?.currentCard && (
                <CardDisplay card={liveTurn.currentCard} settings={settings} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="p-4 sm:p-5 pb-6 sm:pb-8">
        <div className="flex gap-3 max-w-sm mx-auto">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handlePass}
            disabled={noWordsLeft}
            className="flex-1 py-4 sm:py-5 rounded-2xl text-lg font-bold font-game-ui bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors disabled:opacity-30 cursor-pointer touch-manipulation select-none"
          >
            Pass
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCorrect}
            disabled={noWordsLeft}
            className="flex-[2] py-4 sm:py-5 rounded-2xl text-lg font-bold font-game-ui text-white transition-colors disabled:opacity-30 cursor-pointer touch-manipulation select-none"
            style={{
              background: `linear-gradient(135deg, ${tc.bg}, ${tc.mid || tc.bg})`,
              boxShadow: `0 6px 0 ${tc.text || '#000'}, 0 8px 20px rgba(0,0,0,0.3)`,
            }}
          >
            Correct!
          </motion.button>
        </div>
        <div className="text-center mt-2 text-xs text-gray-400 dark:text-gray-500 hidden sm:block font-game-ui">
          Space = Correct · P = Pass · Esc = Pause
        </div>
      </div>
    </motion.div>
  );
}
