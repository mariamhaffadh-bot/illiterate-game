import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMPStore, mpCorrect, mpSkip, mpDisconnect } from '../../store/multiplayerStore';
import type { MPTeam } from '../../store/multiplayerStore';
import { CATEGORY_META } from '../../types';
import type { BoardCategory } from '../../types';
import { initAudio, startCountdown, stopCountdown, playTimeUp } from '../../engine/audioEngine';

export function MultiplayerGame() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);

  const gs = useMPStore((s) => s.gameState);
  const myId = useMPStore((s) => s.playerId);
  const status = useMPStore((s) => s.status);

  const [flash, setFlash] = useState<'correct' | 'skip' | null>(null);
  const processingRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const timerFiredRef = useRef(false);
  const prevTurnKeyRef = useRef('');
  const [remaining, setRemaining] = useState(0);

  const isExplainer = gs?.currentExplainerId === myId;
  const currentTeam: MPTeam | undefined = gs?.teams?.[gs?.currentTeamIndex];
  const explainer = gs?.players?.find((p: any) => p.id === gs?.currentExplainerId);
  const catKey = (gs?.currentCategory || 'RANDOM') as BoardCategory;
  const catMeta = CATEGORY_META[catKey] || CATEGORY_META.RANDOM;
  const teammates = currentTeam
    ? gs?.players?.filter((p: any) => currentTeam.playerIds.includes(p.id) && p.id !== gs?.currentExplainerId) || []
    : [];

  // Timer
  useEffect(() => {
    if (!gs || gs.phase !== 'playing') return;
    const update = () => {
      const elapsed = (Date.now() - gs.turnStartedAt) / 1000;
      const r = Math.max(0, Math.ceil(gs.timerSeconds - elapsed));
      setRemaining(r);
      if (r <= 10 && r > 0 && !countdownStartedRef.current) {
        countdownStartedRef.current = true;
        initAudio(); startCountdown(r);
      }
      if (r <= 0 && !timerFiredRef.current) {
        timerFiredRef.current = true;
        stopCountdown(); playTimeUp();
      }
    };
    update();
    const iv = setInterval(update, 250);
    return () => clearInterval(iv);
  }, [gs?.turnStartedAt, gs?.timerSeconds, gs?.phase]);

  // Reset on turn change
  useEffect(() => {
    const key = `${gs?.currentExplainerId}_${gs?.turnStartedAt}`;
    if (key !== prevTurnKeyRef.current) {
      prevTurnKeyRef.current = key;
      timerFiredRef.current = false;
      countdownStartedRef.current = false;
    }
  }, [gs?.currentExplainerId, gs?.turnStartedAt]);

  useEffect(() => () => stopCountdown(), []);

  const handleCorrect = useCallback(() => {
    if (processingRef.current || !isExplainer || !gs?.currentWord) return;
    processingRef.current = true; initAudio();
    setFlash('correct'); mpCorrect();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isExplainer, gs?.currentWord]);

  const handleSkip = useCallback(() => {
    if (processingRef.current || !isExplainer || !gs?.currentWord) return;
    processingRef.current = true; initAudio();
    setFlash('skip'); mpSkip();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isExplainer, gs?.currentWord]);

  useEffect(() => {
    if (!isExplainer) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); handleCorrect(); }
      if (e.key === 'p' || e.key === 'P') handleSkip();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isExplainer, handleCorrect, handleSkip]);

  const handleLeave = () => { mpDisconnect(); setMultiplayerMode(null); setPhase('mode_select'); };

  if (status === 'disconnected') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-5xl">😵</div><p className="text-lg text-gray-500 font-game-ui">Connection lost</p>
        <button onClick={handleLeave} className="px-6 py-3 rounded-xl bg-gray-900 text-white font-semibold cursor-pointer font-game-ui">Back to Menu</button>
      </motion.div>
    );
  }

  if (!gs) return <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900"><p className="text-gray-400 font-game-ui animate-pulse">Loading...</p></div>;

  // ── Game Over ─────────────────────────────────────────────────
  if (gs.phase === 'gameOver') {
    const sorted = [...(gs.teams || [])].sort((a: MPTeam, b: MPTeam) => b.score - a.score);
    const MEDALS = ['🥇', '🥈', '🥉'];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-6xl">🏆</div>
        <h1 className="text-4xl font-game-title" style={{ color: sorted[0]?.color }}>{sorted[0]?.name} Wins!</h1>
        <div className="w-full max-w-sm space-y-3">
          {sorted.map((t: MPTeam, i: number) => (
            <motion.div key={t.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.15 }}
              className={`flex items-center gap-4 p-4 rounded-2xl ${i === 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-gray-800'}`}>
              <span className="text-2xl w-10 text-center">{MEDALS[i] || ''}</span>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
              <div className="flex-1">
                <p className="font-bold text-gray-900 dark:text-white font-game-ui">{t.name}</p>
                <p className="text-xs text-gray-400 font-game-ui">{t.playerIds.map(id => gs.players.find((p: any) => p.id === id)?.name).filter(Boolean).join(', ')}</p>
              </div>
              <span className="text-xl font-black tabular-nums">{t.score} pts</span>
            </motion.div>
          ))}
        </div>
        <button onClick={handleLeave} className="mt-4 px-8 py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-lg font-bold cursor-pointer font-game-ui">Back to Menu</button>
      </motion.div>
    );
  }

  // ── Turn Summary ──────────────────────────────────────────────
  if (gs.phase === 'turnSummary') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-xl font-game-ui text-gray-500">⏰ Time's up!</h2>
        <h1 className="text-2xl font-game-title text-gray-900 dark:text-white">{gs.lastTurnTeamName} got {gs.lastTurnScore} word{gs.lastTurnScore !== 1 ? 's' : ''}!</h1>
        <div className="w-full max-w-xs space-y-2">
          {gs.teams.map((t: MPTeam) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white dark:bg-gray-800">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui">{t.name}</span>
              <span className="font-black tabular-nums">{t.score} pts</span>
            </div>
          ))}
        </div>
        <div className="text-center space-y-1 mt-2">
          <p className="text-gray-400 font-game-ui">Next up</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white font-game-ui">{gs.nextTeamName} — {gs.nextExplainerName} explains</p>
        </div>
      </motion.div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────
  const isUrgent = remaining <= 10;
  const isCritical = remaining <= 5;
  const timerColor = isCritical ? '#EF4444' : isUrgent ? '#F59E0B' : '#22C55E';
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // ── EXPLAINER'S PHONE ─────────────────────────────────────────
  if (isExplainer) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className={`min-h-[100dvh] flex flex-col relative overflow-hidden transition-colors duration-300 ${isCritical ? 'bg-red-50 dark:bg-red-950/20' : isUrgent ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-900'}`}>
        <AnimatePresence>{flash && <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.25 }} className={`absolute inset-0 z-30 pointer-events-none ${flash === 'correct' ? 'bg-emerald-400' : 'bg-orange-400'}`} />}</AnimatePresence>

        <div className="p-4 text-center space-y-1">
          <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold font-game-ui">🎯 YOUR TURN, {explainer?.name}!</span>
          <p className="text-sm text-gray-500 font-game-ui">Explaining to: <span className="font-bold" style={{ color: currentTeam?.color }}>👥 {currentTeam?.name}</span></p>
          <p className="text-xs text-gray-400 font-game-ui">({teammates.map((p: any) => p.name).join(', ')})</p>
        </div>

        <div className="text-center">
          <div className="category-tile category-tile-raised inline-flex px-4 py-1.5 text-sm" style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, '--tile-dark': catMeta.dark } as React.CSSProperties}>
            {catMeta.icon} {catMeta.label}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-4">
          <AnimatePresence mode="wait">
            {gs.currentWord ? (
              <motion.div key={gs.currentWord} initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, x: -60 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }} className="w-full max-w-sm" style={{ perspective: '600px' }}>
                <div className="word-card" style={{ '--card-accent': catMeta.bg } as React.CSSProperties}>
                  <div className="pt-6 pb-5 px-6 text-center">
                    <p className="word-text text-3xl sm:text-4xl font-bold">{gs.currentWord}</p>
                  </div>
                </div>
              </motion.div>
            ) : <p className="text-xl text-gray-400 font-game-ui">No more words!</p>}
          </AnimatePresence>
        </div>

        <div className="text-center py-2">
          <span className="text-4xl font-black tabular-nums font-game-title" style={{ color: timerColor }}>
            {remaining <= 0 ? 'TIME!' : timeStr}
          </span>
        </div>

        {remaining > 0 && (
          <div className="p-4 pb-6">
            <div className="flex gap-3 max-w-sm mx-auto">
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleSkip} disabled={!gs.currentWord}
                className="flex-1 py-4 rounded-2xl text-lg font-bold font-game-ui bg-white text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 disabled:opacity-30 cursor-pointer touch-manipulation select-none">↷ Skip</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleCorrect} disabled={!gs.currentWord}
                className="flex-[2] py-4 rounded-2xl text-lg font-bold font-game-ui text-white disabled:opacity-30 cursor-pointer touch-manipulation select-none"
                style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, boxShadow: `0 6px 0 ${catMeta.dark}, 0 8px 20px rgba(0,0,0,0.3)` }}>✓ Correct</motion.button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // ── ALL OTHER PHONES ──────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={`min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-5 transition-colors duration-300 ${isCritical ? 'bg-red-50 dark:bg-red-950/20' : isUrgent ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-900'}`}>

      <div className="text-center space-y-1">
        <span className="px-4 py-1.5 rounded-full text-sm font-bold text-white font-game-ui" style={{ backgroundColor: currentTeam?.color }}>
          🎮 {currentTeam?.name}'s Turn
        </span>
        <p className="text-lg text-gray-900 dark:text-white font-game-ui font-bold mt-2">{explainer?.name} is explaining</p>
      </div>

      <div className="category-tile category-tile-raised px-5 py-2 text-lg" style={{ background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`, '--tile-dark': catMeta.dark } as React.CSSProperties}>
        {catMeta.icon} {catMeta.label}
      </div>

      {/* Timer */}
      <motion.span className="text-6xl font-black tabular-nums font-game-title" style={{ color: timerColor }}
        animate={isCritical ? { scale: [1, 1.05, 1] } : {}} transition={isCritical ? { duration: 1, repeat: Infinity } : {}}>
        {remaining <= 0 ? 'TIME!' : timeStr}
      </motion.span>

      <p className="text-sm text-gray-500 font-game-ui">This turn: <span className="font-bold text-gray-900 dark:text-white text-lg">{gs.turnScore}</span></p>

      {/* Scoreboard */}
      <div className="w-full max-w-xs space-y-2 mt-2">
        {gs.teams.map((t: MPTeam) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl ${t.id === currentTeam?.id ? 'bg-white dark:bg-gray-700 ring-2' : 'bg-gray-100 dark:bg-gray-800/50'}`}
            style={t.id === currentTeam?.id ? { '--tw-ring-color': currentTeam?.color } as any : {}}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui">{t.name}</span>
            <span className="font-black tabular-nums text-gray-900 dark:text-white">{t.score}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
