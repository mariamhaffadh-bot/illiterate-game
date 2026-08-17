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
  const setMPMode = useGameStore((s) => s.setMultiplayerMode);
  const gs = useMPStore((s) => s.gameState);
  const myId = useMPStore((s) => s.playerId);
  const status = useMPStore((s) => s.status);

  const [flash, setFlash] = useState<'correct' | 'skip' | null>(null);
  const processingRef = useRef(false);
  const countdownRef = useRef(false);
  const timerFiredRef = useRef(false);
  const prevKeyRef = useRef('');
  const [remaining, setRemaining] = useState(0);

  const isExplainer = gs?.currentExplainerId === myId;
  const curTeam: MPTeam | undefined = gs?.teams?.[gs?.currentTeamIndex];
  const explainer = gs?.players?.find((p: any) => p.id === gs?.currentExplainerId);
  const cat = (gs?.currentCategory || 'RANDOM') as BoardCategory;
  const meta = CATEGORY_META[cat] || CATEGORY_META.RANDOM;
  const mates = curTeam ? gs?.players?.filter((p: any) => curTeam.playerIds.includes(p.id) && p.id !== gs?.currentExplainerId) || [] : [];

  // Timer sync
  useEffect(() => {
    if (!gs || gs.phase !== 'playing') return;
    const tick = () => {
      const r = Math.max(0, Math.ceil(gs.timerSeconds - (Date.now() - gs.turnStartedAt) / 1000));
      setRemaining(r);
      if (r <= 10 && r > 0 && !countdownRef.current) { countdownRef.current = true; initAudio(); startCountdown(r); }
      if (r <= 0 && !timerFiredRef.current) { timerFiredRef.current = true; stopCountdown(); playTimeUp(); }
    };
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [gs?.turnStartedAt, gs?.timerSeconds, gs?.phase]);

  // Reset on turn change
  useEffect(() => {
    const k = `${gs?.currentExplainerId}_${gs?.turnStartedAt}`;
    if (k !== prevKeyRef.current) { prevKeyRef.current = k; timerFiredRef.current = false; countdownRef.current = false; }
  }, [gs?.currentExplainerId, gs?.turnStartedAt]);

  useEffect(() => () => stopCountdown(), []);

  const onCorrect = useCallback(() => {
    if (processingRef.current || !isExplainer || !gs?.currentWord) return;
    processingRef.current = true; initAudio(); setFlash('correct'); mpCorrect();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isExplainer, gs?.currentWord]);

  const onSkip = useCallback(() => {
    if (processingRef.current || !isExplainer || !gs?.currentWord) return;
    processingRef.current = true; initAudio(); setFlash('skip'); mpSkip();
    setTimeout(() => { setFlash(null); processingRef.current = false; }, 200);
  }, [isExplainer, gs?.currentWord]);

  useEffect(() => {
    if (!isExplainer) return;
    const h = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); onCorrect(); } if (e.key === 'p' || e.key === 'P') onSkip(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [isExplainer, onCorrect, onSkip]);

  const leave = () => { mpDisconnect(); setMPMode(null); setPhase('mode_select'); };

  if (status === 'disconnected') return <Centered><p className="text-5xl">😵</p><p className="text-lg text-gray-500 font-game-ui">Connection lost</p><Btn onClick={leave}>Back to Menu</Btn></Centered>;
  if (!gs) return <Centered><p className="text-gray-400 font-game-ui animate-pulse">Loading...</p></Centered>;

  const urg = remaining <= 10, crit = remaining <= 5;
  const tCol = crit ? '#EF4444' : urg ? '#F59E0B' : '#22C55E';
  const tStr = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  // ── Game Over ─────────────────────────────────────────────────
  if (gs.phase === 'gameOver') {
    const sorted = [...(gs.teams || [])].sort((a: MPTeam, b: MPTeam) => b.score - a.score);
    return (
      <Centered>
        <p className="text-6xl">🏆</p>
        <h1 className="font-game-title" style={{ color: sorted[0]?.color, fontSize: 'clamp(1.8rem, 6vw, 2.5rem)' }}>{sorted[0]?.name} Wins!</h1>
        <div className="w-full space-y-3" style={{ maxWidth: 400 }}>
          {sorted.map((t: MPTeam, i: number) => (
            <motion.div key={t.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.15 }}
              className={`flex items-center gap-4 p-4 rounded-2xl ${i === 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-gray-800'}`}>
              <span className="text-2xl w-10 text-center">{['🥇', '🥈', '🥉'][i] || ''}</span>
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white font-game-ui truncate">{t.name}</p>
                <p className="text-xs text-gray-400 font-game-ui truncate">{t.playerIds.map(id => gs.players.find((p: any) => p.id === id)?.name).filter(Boolean).join(', ')}</p>
              </div>
              <span className="text-xl font-black tabular-nums">{t.score}</span>
            </motion.div>
          ))}
        </div>
        <Btn onClick={leave}>Back to Menu</Btn>
      </Centered>
    );
  }

  // ── Turn Summary ──────────────────────────────────────────────
  if (gs.phase === 'turnSummary') {
    return (
      <Centered>
        <h2 className="text-xl font-game-ui text-gray-500">⏰ Time's up!</h2>
        <h1 className="text-2xl font-game-title text-gray-900 dark:text-white">{gs.lastTurnTeamName} got {gs.lastTurnScore} word{gs.lastTurnScore !== 1 ? 's' : ''}!</h1>
        <Scoreboard teams={gs.teams} players={gs.players} activeTeamId={null} />
        <div className="text-center space-y-1 mt-2">
          <p className="text-gray-400 font-game-ui">Next up</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white font-game-ui">{gs.nextTeamName} — {gs.nextExplainerName}</p>
        </div>
      </Centered>
    );
  }

  // ── EXPLAINER ─────────────────────────────────────────────────
  if (isExplainer) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className={`min-h-[100dvh] flex flex-col relative overflow-hidden transition-colors duration-300 ${crit ? 'bg-red-50 dark:bg-red-950/20' : urg ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-900'}`}>
        <AnimatePresence>{flash && <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} transition={{ duration: 0.25 }} className={`absolute inset-0 z-30 pointer-events-none ${flash === 'correct' ? 'bg-emerald-400' : 'bg-orange-400'}`} />}</AnimatePresence>

        <div className="p-4 text-center space-y-1">
          <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold font-game-ui">🎯 YOUR TURN, {explainer?.name}!</span>
          <p className="text-sm text-gray-500 font-game-ui">Explain to: <span className="font-bold" style={{ color: curTeam?.color }}>{mates.map((p: any) => p.name).join(' & ')}</span></p>
        </div>

        <div className="text-center"><CatBadge meta={meta} /></div>

        <div className="flex-1 flex items-center justify-center px-4 py-3" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <AnimatePresence mode="wait">
            {gs.currentWord ? (
              <motion.div key={gs.currentWord} initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, x: -60 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }} className="w-full" style={{ perspective: '600px' }}>
                <div className="word-card" style={{ '--card-accent': meta.bg } as React.CSSProperties}>
                  <div className="pt-6 pb-5 px-6 text-center"><p className="word-text" style={{ fontSize: 'clamp(1.8rem, 6vw, 2.5rem)' }}>{gs.currentWord}</p></div>
                </div>
              </motion.div>
            ) : <p className="text-xl text-gray-400 font-game-ui">No more words!</p>}
          </AnimatePresence>
        </div>

        <div className="text-center py-2">
          <span className="font-black tabular-nums font-game-title" style={{ color: tCol, fontSize: 'clamp(2rem, 6vw, 3rem)' }}>{remaining <= 0 ? 'TIME!' : tStr}</span>
        </div>

        {remaining > 0 && (
          <div className="p-4 pb-6" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
            <div className="flex gap-3">
              <motion.button whileTap={{ scale: 0.95 }} onClick={onSkip} disabled={!gs.currentWord}
                className="flex-1 rounded-2xl font-bold font-game-ui bg-white text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 disabled:opacity-30 cursor-pointer touch-manipulation select-none"
                style={{ minHeight: 52, fontSize: 'clamp(1rem, 3vw, 1.2rem)' }}>↷ Skip</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={onCorrect} disabled={!gs.currentWord}
                className="flex-[2] rounded-2xl font-bold font-game-ui text-white disabled:opacity-30 cursor-pointer touch-manipulation select-none"
                style={{ minHeight: 52, fontSize: 'clamp(1rem, 3vw, 1.2rem)', background: `linear-gradient(135deg, ${meta.color}, ${meta.bg})`, boxShadow: `0 6px 0 ${meta.dark}, 0 8px 20px rgba(0,0,0,0.3)` }}>✓ Correct</motion.button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // ── ALL OTHER PHONES ──────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={`min-h-[100dvh] flex flex-col items-center p-5 gap-4 transition-colors duration-300 ${crit ? 'bg-red-50 dark:bg-red-950/20' : urg ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-gray-50 dark:bg-gray-900'}`}
      style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="text-center space-y-1 pt-2">
        <span className="px-4 py-1.5 rounded-full text-sm font-bold text-white font-game-ui" style={{ backgroundColor: curTeam?.color }}>
          {curTeam?.name}'s Turn
        </span>
        <p className="text-base text-gray-900 dark:text-white font-game-ui font-bold mt-2">{explainer?.name} is explaining</p>
      </div>

      <CatBadge meta={meta} />

      {/* Timer */}
      <motion.span className="font-black tabular-nums font-game-title" style={{ color: tCol, fontSize: 'clamp(2.5rem, 8vw, 4rem)' }}
        animate={crit ? { scale: [1, 1.05, 1] } : {}} transition={crit ? { duration: 1, repeat: Infinity } : {}}>
        {remaining <= 0 ? 'TIME!' : tStr}
      </motion.span>

      <p className="text-sm text-gray-500 font-game-ui">This turn: <span className="font-bold text-gray-900 dark:text-white text-lg">{gs.turnScore}</span></p>

      {/* Scoreboard */}
      <Scoreboard teams={gs.teams} players={gs.players} activeTeamId={curTeam?.id || null} />
    </motion.div>
  );
}

// ── Shared UI ───────────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-5 bg-gray-50 dark:bg-gray-900" style={{ maxWidth: 480, margin: '0 auto' }}>{children}</div>;
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="mt-4 px-8 py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold cursor-pointer font-game-ui" style={{ minHeight: 52, fontSize: 'clamp(1rem, 3vw, 1.1rem)' }}>{children}</button>;
}

function CatBadge({ meta }: { meta: { color: string; bg: string; dark: string; icon: string; label: string } }) {
  return (
    <div className="category-tile category-tile-raised inline-flex px-4 py-1.5" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.bg})`, '--tile-dark': meta.dark, fontSize: 'clamp(0.85rem, 2.5vw, 1rem)' } as React.CSSProperties}>
      {meta.icon} {meta.label}
    </div>
  );
}

function Scoreboard({ teams, activeTeamId }: { teams: MPTeam[]; players: any[]; activeTeamId: string | null }) {
  return (
    <div className="w-full space-y-2" style={{ maxWidth: 400 }}>
      {teams.map((t: MPTeam) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl ${t.id === activeTeamId ? 'bg-white dark:bg-gray-700 ring-2' : 'bg-gray-100 dark:bg-gray-800/50'}`}
          style={t.id === activeTeamId ? { ringColor: t.color, '--tw-ring-color': t.color } as any : {}}>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
          <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui truncate" style={{ fontSize: '1rem' }}>{t.name}</span>
          <span className="font-black tabular-nums text-gray-900 dark:text-white">{t.score} pts</span>
        </div>
      ))}
    </div>
  );
}
