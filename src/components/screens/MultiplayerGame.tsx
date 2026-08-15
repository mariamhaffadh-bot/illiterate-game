import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMultiplayerStore, sendCorrect, sendSkip, sendEndTurn, disconnectMultiplayer } from '../../store/multiplayerStore';
import type { MPTeam } from '../../store/multiplayerStore';
import { CATEGORY_META } from '../../types';
import type { BoardCategory } from '../../types';
import { initAudio, startCountdown, stopCountdown, playTimeUp } from '../../engine/audioEngine';

export function MultiplayerGame() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);

  const gameState = useMultiplayerStore((s) => s.gameState);
  const myId = useMultiplayerStore((s) => s.playerId);
  const status = useMultiplayerStore((s) => s.status);

  const [flash, setFlash] = useState<'correct' | 'skip' | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const processingRef = useRef(false);
  const timerExpiredRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const prevTurnKeyRef = useRef('');

  // Derived state
  const isExplainer = gameState?.currentExplainerId === myId;
  const currentTeam: MPTeam | undefined = gameState?.teams?.[gameState?.currentTeamIndex];
  const isOnCurrentTeam = currentTeam?.playerIds?.includes(myId || '') ?? false;
  const explainer = gameState?.players?.find((p: any) => p.id === gameState?.currentExplainerId);
  const catKey = (gameState?.currentCategory || 'RANDOM') as BoardCategory;
  const catMeta = CATEGORY_META[catKey] || CATEGORY_META.RANDOM;

  // Teammates (excluding the explainer)
  const teammates = currentTeam
    ? gameState?.players?.filter((p: any) => currentTeam.playerIds.includes(p.id) && p.id !== gameState?.currentExplainerId) || []
    : [];

  // Timer
  const [remaining, setRemaining] = useState(gameState?.timerSeconds || 30);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    const update = () => {
      const elapsed = (Date.now() - gameState.turnStartedAt) / 1000;
      const r = Math.max(0, Math.ceil(gameState.timerSeconds - elapsed));
      setRemaining(r);
      if (r <= 10 && r > 0 && !countdownStartedRef.current) {
        countdownStartedRef.current = true;
        initAudio();
        startCountdown(r);
      }
      if (r <= 0 && !timerExpiredRef.current) {
        timerExpiredRef.current = true;
        stopCountdown();
        playTimeUp();
        setTimerExpired(true);
        if (isExplainer) setTimeout(() => sendEndTurn(), 1500);
      }
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [gameState?.turnStartedAt, gameState?.timerSeconds, gameState?.phase, isExplainer]);

  // Reset on turn change
  useEffect(() => {
    const key = `${gameState?.currentExplainerId}_${gameState?.turnStartedAt}`;
    if (key !== prevTurnKeyRef.current) {
      prevTurnKeyRef.current = key;
      timerExpiredRef.current = false;
      countdownStartedRef.current = false;
      setTimerExpired(false);
    }
  }, [gameState?.currentExplainerId, gameState?.turnStartedAt]);

  useEffect(() => () => stopCountdown(), []);

  const handleCorrect = useCallback(() => {
    if (processingRef.current || !isExplainer || !gameState?.currentWord) return;
    processingRef.current = true;
    initAudio();
    setFlash('correct');
    sendCorrect();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isExplainer, gameState?.currentWord]);

  const handleSkip = useCallback(() => {
    if (processingRef.current || !isExplainer || !gameState?.currentWord) return;
    processingRef.current = true;
    initAudio();
    setFlash('skip');
    sendSkip();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isExplainer, gameState?.currentWord]);

  // Keyboard
  useEffect(() => {
    if (!isExplainer) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); handleCorrect(); }
      if (e.key === 'p' || e.key === 'P') handleSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isExplainer, handleCorrect, handleSkip]);

  const handleLeave = () => { disconnectMultiplayer(); setMultiplayerMode(null); setPhase('mode_select'); };

  // ── Connection lost ───────────────────────────────────────────
  if (status === 'disconnected') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-5xl">😵</div>
        <p className="text-lg text-gray-500 font-game-ui">Connection lost</p>
        <button onClick={handleLeave} className="px-6 py-3 rounded-xl bg-gray-900 text-white font-semibold cursor-pointer font-game-ui">Back to Menu</button>
      </motion.div>
    );
  }

  if (!gameState) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900"><p className="text-gray-400 font-game-ui animate-pulse">Loading...</p></div>;
  }

  // ── Game Over ─────────────────────────────────────────────────
  if (gameState.phase === 'gameOver') {
    const sorted = [...(gameState.teams || [])].sort((a: MPTeam, b: MPTeam) => b.score - a.score);
    const MEDALS = ['🥇', '🥈', '🥉'];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-6xl">🏆</div>
        <h1 className="text-4xl font-game-title text-gray-900 dark:text-white">Game Over!</h1>
        <div className="w-full max-w-sm space-y-3">
          {sorted.map((t: MPTeam, i: number) => (
            <motion.div key={t.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.15 }}
              className={`flex items-center gap-4 p-4 rounded-2xl ${i === 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-gray-800'}`}>
              <span className="text-2xl w-10 text-center">{MEDALS[i] || ''}</span>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
              <div className="flex-1">
                <p className="font-bold text-gray-900 dark:text-white font-game-ui">{t.name}</p>
                <p className="text-xs text-gray-400 font-game-ui">{t.playerIds.map(id => gameState.players.find((p: any) => p.id === id)?.name).filter(Boolean).join(', ')}</p>
              </div>
              <span className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{t.score}</span>
            </motion.div>
          ))}
        </div>
        <button onClick={handleLeave} className="mt-4 px-8 py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-lg font-bold cursor-pointer font-game-ui">Back to Menu</button>
      </motion.div>
    );
  }

  // ── Turn Summary ──────────────────────────────────────────────
  if (gameState.phase === 'turnSummary') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-2xl font-game-title text-gray-900 dark:text-white">{gameState.lastTurnTeamName}'s turn is over!</h2>
        <div className="text-center">
          <p className="text-gray-500 font-game-ui">Words guessed</p>
          <p className="text-6xl font-black text-gray-900 dark:text-white font-game-title">{gameState.lastTurnScore} 🎉</p>
        </div>

        {/* Scoreboard */}
        <div className="w-full max-w-xs space-y-2">
          {gameState.teams.map((t: MPTeam) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white dark:bg-gray-800">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui">{t.name}</span>
              <span className="font-black tabular-nums text-gray-900 dark:text-white">{t.score} pts</span>
            </div>
          ))}
        </div>

        <div className="text-center space-y-1 mt-4">
          <p className="text-gray-400 font-game-ui">Next up</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white font-game-ui">{gameState.nextTeamName} — {gameState.nextExplainerName} explains</p>
        </div>
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

  // ── EXPLAINER VIEW ────────────────────────────────────────────
  if (isExplainer) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className={`min-h-[100dvh] flex flex-col relative overflow-hidden transition-colors duration-300 ${isCritical ? 'bg-red-50 dark:bg-red-950/20' : isUrgent ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-900'}`}>
        <AnimatePresence>{flash && <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className={`absolute inset-0 z-30 pointer-events-none ${flash === 'correct' ? 'bg-emerald-400' : 'bg-orange-400'}`} />}</AnimatePresence>

        {/* Header */}
        <div className="p-4 text-center space-y-1">
          <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold font-game-ui">🎯 YOUR TURN!</span>
          <p className="text-sm text-gray-500 font-game-ui">
            You are explaining to: <span className="font-bold" style={{ color: currentTeam?.color }}>👥 {currentTeam?.name}</span>
          </p>
          <p className="text-xs text-gray-400 font-game-ui">({teammates.map((p: any) => p.name).join(', ')})</p>
        </div>

        {/* Category */}
        <div className="text-center">
          <div className="category-tile category-tile-raised inline-flex px-4 py-1.5 text-sm" style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, '--tile-dark': catMeta.dark } as React.CSSProperties}>
            {catMeta.icon} {catMeta.label}
          </div>
        </div>

        {/* Word card */}
        <div className="flex-1 flex items-center justify-center px-4 py-4">
          <AnimatePresence mode="wait">
            {gameState.currentWord ? (
              <motion.div key={gameState.currentWord} initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, x: -60 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }} className="w-full max-w-sm" style={{ perspective: '600px' }}>
                <div className="word-card" style={{ '--card-accent': catMeta.bg } as React.CSSProperties}>
                  <div className="pt-6 pb-5 px-6 text-center">
                    <p className="word-text text-3xl sm:text-4xl font-bold">{gameState.currentWord}</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <p className="text-xl text-gray-400 font-game-ui">No more words!</p>
            )}
          </AnimatePresence>
        </div>

        {/* Timer */}
        <div className="text-center py-2">
          <span className="text-4xl font-black tabular-nums font-game-title" style={{ color: timerColor }}>
            {timerExpired ? 'TIME!' : timeStr}
          </span>
        </div>

        {/* Buttons */}
        {!timerExpired && (
          <div className="p-4 pb-6">
            <div className="flex gap-3 max-w-sm mx-auto">
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleSkip} disabled={!gameState.currentWord}
                className="flex-1 py-4 rounded-2xl text-lg font-bold font-game-ui bg-white text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 disabled:opacity-30 cursor-pointer touch-manipulation select-none">
                Skip ↷
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleCorrect} disabled={!gameState.currentWord}
                className="flex-[2] py-4 rounded-2xl text-lg font-bold font-game-ui text-white disabled:opacity-30 cursor-pointer touch-manipulation select-none"
                style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, boxShadow: `0 6px 0 ${catMeta.dark}, 0 8px 20px rgba(0,0,0,0.3)` }}>
                Correct ✓
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // ── GUESSING TEAM VIEW ────────────────────────────────────────
  if (isOnCurrentTeam) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <span className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-bold font-game-ui">👂 LISTEN UP!</span>
        <div className="text-center space-y-2">
          <p className="text-xl text-gray-900 dark:text-white font-game-ui font-bold">{explainer?.name} is explaining</p>
          <p className="text-gray-500 font-game-ui">to YOUR team!</p>
        </div>
        <div className="category-tile category-tile-raised px-5 py-2 text-lg" style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, '--tile-dark': catMeta.dark } as React.CSSProperties}>
          {catMeta.icon} {catMeta.label}
        </div>
        <div className="text-6xl">🙈</div>
        <p className="text-gray-400 font-game-ui">Don't peek!</p>
        <motion.span className="text-5xl font-black tabular-nums font-game-title" style={{ color: timerColor }}
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}} transition={isCritical ? { duration: 1, repeat: Infinity } : {}}>
          {timerExpired ? 'TIME!' : timeStr}
        </motion.span>
        <p className="text-lg font-bold text-gray-900 dark:text-white font-game-ui">Shout out the answer!</p>
        {/* Score */}
        <p className="text-sm text-gray-400 font-game-ui">This turn: <span className="font-bold text-gray-900 dark:text-white">{gameState.turnScore}</span></p>
      </motion.div>
    );
  }

  // ── OTHER TEAM VIEW ───────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
      <span className="px-4 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold font-game-ui">
        ⏳ {currentTeam?.name}'s turn
      </span>
      <div className="text-center space-y-1">
        <p className="text-lg text-gray-900 dark:text-white font-game-ui font-bold">{explainer?.name} → {currentTeam?.name}</p>
        <div className="category-tile category-tile-raised inline-flex px-4 py-1.5 text-sm" style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, '--tile-dark': catMeta.dark } as React.CSSProperties}>
          {catMeta.icon} {catMeta.label}
        </div>
      </div>
      <motion.span className="text-5xl font-black tabular-nums font-game-title" style={{ color: timerColor }}
        animate={isCritical ? { scale: [1, 1.05, 1] } : {}} transition={isCritical ? { duration: 1, repeat: Infinity } : {}}>
        {timerExpired ? 'TIME!' : timeStr}
      </motion.span>

      {/* Scoreboard */}
      <div className="w-full max-w-xs space-y-2">
        <p className="text-sm text-gray-400 font-game-ui text-center font-bold">Scores</p>
        {gameState.teams.map((t: MPTeam) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl ${t.id === currentTeam?.id ? 'bg-white dark:bg-gray-700 ring-2 ring-violet-400' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui">{t.name}</span>
            <span className="font-black tabular-nums text-gray-900 dark:text-white">{t.score} pts</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
