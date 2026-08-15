import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMultiplayerStore, sendCorrect, sendSkip, sendEndTurn, disconnectMultiplayer } from '../../store/multiplayerStore';
import { CATEGORY_META } from '../../types';
import type { BoardCategory } from '../../types';
import { initAudio, startCountdown, stopCountdown, playTimeUp } from '../../engine/audioEngine';

export function MultiplayerGame() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);

  const gameState = useMultiplayerStore((s) => s.gameState);
  const playerId = useMultiplayerStore((s) => s.playerId);
  const status = useMultiplayerStore((s) => s.status);

  const [flash, setFlash] = useState<'correct' | 'skip' | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const processingRef = useRef(false);
  const timerExpiredRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const prevTurnPlayerRef = useRef<string | null>(null);

  const isMyTurn = gameState?.currentPlayerId === playerId;
  const currentPlayer = gameState?.players?.find((p: any) => p.id === gameState?.currentPlayerId);
  const catKey = (gameState?.currentCategory || 'RANDOM') as BoardCategory;
  const catMeta = CATEGORY_META[catKey] || CATEGORY_META.RANDOM;

  // Calculate timer remaining from turnStartedAt
  const [remaining, setRemaining] = useState(gameState?.timerSeconds || 30);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;

    const update = () => {
      const elapsed = (Date.now() - gameState.turnStartedAt) / 1000;
      const r = Math.max(0, Math.ceil(gameState.timerSeconds - elapsed));
      setRemaining(r);

      // Start countdown audio at 10 seconds
      if (r <= 10 && r > 0 && !countdownStartedRef.current) {
        countdownStartedRef.current = true;
        initAudio();
        startCountdown(r);
      }

      // Timer expired — send end_turn (only active player or once)
      if (r <= 0 && !timerExpiredRef.current) {
        timerExpiredRef.current = true;
        stopCountdown();
        playTimeUp();
        setTimerExpired(true);
        // Anyone can trigger end_turn; server handles it idempotently
        setTimeout(() => sendEndTurn(), 1500);
      }
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [gameState?.turnStartedAt, gameState?.timerSeconds, gameState?.phase]);

  // Reset timer state when turn changes
  useEffect(() => {
    if (gameState?.currentPlayerId !== prevTurnPlayerRef.current) {
      prevTurnPlayerRef.current = gameState?.currentPlayerId || null;
      timerExpiredRef.current = false;
      countdownStartedRef.current = false;
      setTimerExpired(false);
    }
  }, [gameState?.currentPlayerId, gameState?.turnStartedAt]);

  const handleCorrect = useCallback(() => {
    if (processingRef.current || !isMyTurn || !gameState?.currentWord) return;
    processingRef.current = true;
    initAudio();
    setFlash('correct');
    sendCorrect();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isMyTurn, gameState?.currentWord]);

  const handleSkip = useCallback(() => {
    if (processingRef.current || !isMyTurn || !gameState?.currentWord) return;
    processingRef.current = true;
    initAudio();
    setFlash('skip');
    sendSkip();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isMyTurn, gameState?.currentWord]);

  // Keyboard controls for active player
  useEffect(() => {
    if (!isMyTurn) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); handleCorrect(); }
      if (e.key === 'p' || e.key === 'P') handleSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMyTurn, handleCorrect, handleSkip]);

  const handleLeave = () => {
    disconnectMultiplayer();
    setMultiplayerMode(null);
    setPhase('mode_select');
  };

  // Connection lost
  if (status === 'disconnected') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-5xl">😵</div>
        <p className="text-lg text-gray-500 font-game-ui">Connection lost</p>
        <button onClick={handleLeave} className="px-6 py-3 rounded-xl bg-gray-900 text-white font-semibold cursor-pointer">Back to Menu</button>
      </motion.div>
    );
  }

  if (!gameState) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-400 font-game-ui animate-pulse">Loading game...</p>
      </motion.div>
    );
  }

  // ── Game Over ─────────────────────────────────────────────────
  if (gameState.phase === 'gameOver') {
    const sorted = [...gameState.players].sort((a: any, b: any) => (gameState.scores[b.id] || 0) - (gameState.scores[a.id] || 0));
    const MEDALS = ['🥇', '🥈', '🥉'];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-6xl">🏆</div>
        <h1 className="text-4xl font-game-title text-gray-900 dark:text-white">Game Over!</h1>

        <div className="w-full max-w-sm space-y-3">
          {sorted.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-4 p-4 rounded-2xl ${i === 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-gray-800'}`}
            >
              <span className="text-2xl w-10 text-center">{MEDALS[i] || ''}</span>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="flex-1 font-bold text-gray-900 dark:text-white font-game-ui">{p.name}</span>
              <span className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{gameState.scores[p.id] || 0}</span>
            </motion.div>
          ))}
        </div>

        <button onClick={handleLeave} className="mt-6 px-8 py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-lg font-bold cursor-pointer font-game-ui">
          Back to Menu
        </button>
      </motion.div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────

  const isUrgent = remaining <= 10;
  const isCritical = remaining <= 5;
  const timerColor = isCritical ? '#EF4444' : isUrgent ? '#F59E0B' : '#22C55E';
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className={`min-h-[100dvh] flex flex-col relative overflow-hidden transition-colors duration-300 ${
        isCritical ? 'bg-red-50 dark:bg-red-950/20' : isUrgent ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-900'
      }`}
    >
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`absolute inset-0 z-30 pointer-events-none ${flash === 'correct' ? 'bg-emerald-400' : 'bg-orange-400'}`}
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="category-tile category-tile-raised px-3 py-1.5 text-sm"
            style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, '--tile-dark': catMeta.dark } as React.CSSProperties}>
            {catMeta.icon} {catMeta.label}
          </div>
          {isMyTurn && (
            <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold">YOUR TURN 🎯</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 font-game-ui block">Round {gameState.round}</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white font-game-ui tabular-nums">Score: {gameState.turnScore}</span>
        </div>
      </div>

      {/* Timer */}
      <div className="text-center py-2">
        <motion.span
          className="text-5xl font-black tabular-nums font-game-title"
          style={{ color: timerColor }}
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
          transition={isCritical ? { duration: 1, repeat: Infinity } : {}}
        >
          {timerExpired ? 'TIME!' : (remaining <= 5 && remaining > 0 ? remaining : timeStr)}
        </motion.span>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center px-4 py-4">
        {isMyTurn ? (
          // ── Active player: show the word ──────────────────
          <AnimatePresence mode="wait">
            {gameState.currentWord ? (
              <motion.div
                key={gameState.currentWord}
                initial={{ opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="w-full max-w-sm"
                style={{ perspective: '600px' }}
              >
                <div className="word-card" style={{ '--card-accent': catMeta.bg } as React.CSSProperties}>
                  <div className="pt-6 pb-5 px-6 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-game-ui">{catMeta.label}</p>
                    <p className="word-text text-3xl sm:text-4xl font-bold">{gameState.currentWord}</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center">
                <p className="text-xl text-gray-400 font-game-ui">No more words!</p>
              </div>
            )}
          </AnimatePresence>
        ) : (
          // ── Spectator: hide the word ──────────────────────
          <div className="text-center space-y-4">
            <div className="text-6xl">🙈</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-game-ui">
              {currentPlayer?.name}'s turn!
            </h2>
            <p className="text-gray-400 dark:text-gray-500 font-game-ui">Don't peek!</p>
          </div>
        )}
      </div>

      {/* Action buttons — only for active player */}
      {isMyTurn && !timerExpired && (
        <div className="p-4 pb-6">
          <div className="flex gap-3 max-w-sm mx-auto">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSkip}
              disabled={!gameState.currentWord}
              className="flex-1 py-4 rounded-2xl text-lg font-bold font-game-ui bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors disabled:opacity-30 cursor-pointer touch-manipulation select-none"
            >
              Skip
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCorrect}
              disabled={!gameState.currentWord}
              className="flex-[2] py-4 rounded-2xl text-lg font-bold font-game-ui text-white transition-colors disabled:opacity-30 cursor-pointer touch-manipulation select-none"
              style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, boxShadow: `0 6px 0 ${catMeta.dark}, 0 8px 20px rgba(0,0,0,0.3)` }}
            >
              Correct!
            </motion.button>
          </div>
          <div className="text-center mt-2 text-xs text-gray-400 hidden sm:block font-game-ui">
            Space = Correct · P = Skip
          </div>
        </div>
      )}

      {/* Scoreboard — shown for spectators and below active player */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap justify-center gap-3">
          {gameState.players.map((p: any) => {
            const isActive = p.id === gameState.currentPlayerId;
            return (
              <div key={p.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-game-ui ${isActive ? 'bg-white/80 dark:bg-gray-700 ring-2 ring-violet-400' : 'bg-gray-100 dark:bg-gray-800/50'}`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="font-semibold text-gray-700 dark:text-gray-300">{p.name}</span>
                <span className="font-black text-gray-900 dark:text-white tabular-nums">{gameState.scores[p.id] || 0}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
