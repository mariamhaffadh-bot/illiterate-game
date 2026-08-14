import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDisplaySync } from '../../hooks/useDisplaySync';
import { GameBoard } from '../board/GameBoard';
import { CATEGORY_META, GAME_PIECES } from '../../types';
import type { PublicDisplayState } from '../../types/display';

// ── Fullscreen helper ──────────────────────────────────────────

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return { isFullscreen, toggle };
}

// ── Timer that derives from timestamps ─────────────────────────

function useDisplayTimer(state: PublicDisplayState | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!state || state.phase !== 'playing') {
      setRemaining(state?.turnDuration ?? 0);
      return;
    }

    if (state.isPaused && state.pausedWithRemaining !== null) {
      setRemaining(state.pausedWithRemaining);
      return;
    }

    if (!state.turnStartedAt) {
      setRemaining(state.turnDuration);
      return;
    }

    // Calculate remaining from timestamps
    const update = () => {
      const elapsed = (Date.now() - state.turnStartedAt!) / 1000;
      const r = Math.max(0, Math.ceil(state.turnDuration - elapsed));
      setRemaining(r);
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [state?.turnStartedAt, state?.turnDuration, state?.isPaused, state?.pausedWithRemaining, state?.phase]);

  const isUrgent = remaining <= 10;
  const isCritical = remaining <= 5;
  return { remaining, isUrgent, isCritical };
}

// ── Main Display Page ──────────────────────────────────────────

export function DisplayPage({ gameId }: { gameId: string }) {
  const { state, status } = useDisplaySync(gameId);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const { remaining, isUrgent, isCritical } = useDisplayTimer(state);

  // Connection overlays
  if (status === 'not_found') {
    return <StatusScreen icon="?" title="Game Not Found" subtitle="Check the display link and try again." />;
  }

  if (!state && status === 'connecting') {
    return <StatusScreen icon="" title="Connecting..." subtitle={`Joining game ${gameId}`} pulse />;
  }

  if (!state) {
    return (
      <StatusScreen
        icon=""
        title="Waiting for game..."
        subtitle="The host hasn't started the game yet."
        pulse
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-950 text-white overflow-hidden relative select-none">
      {/* Fullscreen button */}
      {!isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium backdrop-blur-sm transition-colors cursor-pointer"
        >
          Enter Fullscreen
        </button>
      )}

      {/* Reconnecting overlay */}
      <AnimatePresence>
        {status === 'disconnected' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-amber-500/90 text-white text-sm font-medium backdrop-blur-sm"
          >
            Reconnecting to game...
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state.phase === 'waiting' && (
          <DisplayWaiting key="waiting" state={state} />
        )}
        {state.phase === 'turn_intro' && (
          <DisplayTurnIntro key="intro" state={state} />
        )}
        {state.phase === 'playing' && (
          <DisplayPlaying key="playing" state={state} remaining={remaining} isUrgent={isUrgent} isCritical={isCritical} />
        )}
        {state.phase === 'turn_review' && (
          <DisplayReview key="review" state={state} />
        )}
        {state.phase === 'piece_moving' && (
          <DisplayPieceMoving key="moving" state={state} />
        )}
        {(state.phase === 'game_over' || state.phase === 'redemption_result') && (
          <DisplayGameOver key="gameover" state={state} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Status Screen ──────────────────────────────────────────────

function StatusScreen({
  icon, title, subtitle, pulse, onFullscreen, isFullscreen,
}: {
  icon: string;
  title: string;
  subtitle: string;
  pulse?: boolean;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
}) {
  return (
    <div className="min-h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <div className={`text-6xl ${pulse ? 'animate-pulse' : ''}`}>{icon}</div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-gray-400 text-lg">{subtitle}</p>
        {onFullscreen && !isFullscreen && (
          <button
            onClick={onFullscreen}
            className="mt-8 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
          >
            Enter Fullscreen
          </button>
        )}
      </div>
    </div>
  );
}

// ── Waiting ────────────────────────────────────────────────────

function DisplayWaiting({ state }: { state: PublicDisplayState }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-8"
    >
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Illi<span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">terate</span>
        </h1>
        <p className="text-xl text-gray-400">Setting up the game...</p>
        <div className="animate-pulse text-5xl mt-4">🎲</div>
        {state.teams.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {state.teams.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold" style={{ background: t.color }}>
                {GAME_PIECES.find((p) => p.id === t.pieceId)?.emoji} {t.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Turn Intro ─────────────────────────────────────────────────

function DisplayTurnIntro({ state }: { state: PublicDisplayState }) {
  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);
  const catMeta = CATEGORY_META[state.currentCategory as keyof typeof CATEGORY_META] ?? CATEGORY_META.RANDOM;
  const piece = activeTeam ? GAME_PIECES.find((p) => p.id === activeTeam.pieceId) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col lg:flex-row"
    >
      {/* Board (left side on large screens) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-8 bg-gray-900/50">
        <div className="w-full max-w-[750px]">
          <GameBoard
            spaces={state.boardSpaces}
            teams={state.teams as any}
            settings={state.settings as any}
            highlightSpace={activeTeam?.boardPosition}
          />
        </div>
      </div>

      {/* Turn info */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center space-y-8"
        >
          {state.redemptionMode && !state.playingForPlacements && (
            <span className="inline-flex items-center px-5 py-2 rounded-full bg-red-500 text-sm font-extrabold uppercase tracking-wider">
              Redemption Round
            </span>
          )}
          {state.playingForPlacements && (
            <span className="inline-flex items-center px-5 py-2 rounded-full bg-violet-500 text-sm font-extrabold uppercase tracking-wider">
              Playing for Placements
            </span>
          )}

          <div className="space-y-3">
            <p className="text-xl text-gray-400 uppercase tracking-wider font-medium">Up Next</p>
            <h1 className="text-6xl sm:text-7xl font-extrabold" style={{ color: activeTeam?.color }}>
              {piece?.emoji} {activeTeam?.name}
            </h1>
          </div>

          <div className="space-y-2">
            <p className="text-2xl text-gray-300 font-medium">
              {state.activePlayerName} is describing
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-lg text-gray-500">Category</p>
            <div
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-3xl font-extrabold text-white"
              style={{ backgroundColor: catMeta.bg }}
            >
              {state.isSpadeTurn ? '♠ Spade — Act It Out!' : state.currentCategoryLabel}
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-2xl text-gray-500 font-bold uppercase tracking-widest pt-4"
          >
            Get Ready
          </motion.p>

          {/* Mini scoreboard */}
          <div className="pt-4 space-y-2 max-w-md mx-auto">
            {state.teams
              .slice()
              .sort((a, b) => b.boardPosition - a.boardPosition)
              .map((t) => {
                const p = GAME_PIECES.find((gp) => gp.id === t.pieceId);
                const isActive = t.id === state.activeTeamId;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm ${
                      isActive ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'
                    }`}
                  >
                    <span className="text-lg">{p?.emoji}</span>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="flex-1 text-left font-medium">{t.name}</span>
                    <span className="font-bold tabular-nums text-gray-400">
                      {t.boardPosition} / {state.settings.boardSize}
                    </span>
                  </div>
                );
              })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Playing (Timer + Score) ────────────────────────────────────

function DisplayPlaying({
  state, remaining, isUrgent, isCritical,
}: {
  state: PublicDisplayState;
  remaining: number;
  isUrgent: boolean;
  isCritical: boolean;
}) {
  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);
  const catMeta = CATEGORY_META[state.currentCategory as keyof typeof CATEGORY_META] ?? CATEGORY_META.RANDOM;

  const timerColor = isCritical ? '#EF4444' : isUrgent ? '#F59E0B' : '#22C55E';
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`min-h-[100dvh] flex flex-col items-center justify-center p-8 transition-colors duration-500 ${
        isCritical ? 'bg-red-950/40' : isUrgent ? 'bg-amber-950/20' : 'bg-gray-950'
      }`}
    >
      {/* Top bar: team + category */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between p-6 z-10">
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl text-lg font-bold text-white" style={{ backgroundColor: activeTeam?.color }}>
            {activeTeam?.name}
          </div>
          <div className="px-3 py-1.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: catMeta.bg }}>
            {state.isSpadeTurn ? '♠ Spade' : state.currentCategoryLabel}
          </div>
        </div>
        <div className="text-sm text-gray-400">
          {state.activePlayerName} is describing
        </div>
      </div>

      {/* Center: giant timer */}
      <div className="flex flex-col items-center gap-12">
        {/* Pause overlay */}
        {state.isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-20"
          >
            <h2 className="text-6xl font-bold text-white">Paused</h2>
          </motion.div>
        )}

        <motion.div
          className="text-center"
          animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
          transition={isCritical ? { duration: 1, repeat: Infinity } : {}}
        >
          <motion.span
            className="text-[12rem] sm:text-[16rem] font-black tabular-nums leading-none block"
            style={{ color: timerColor }}
            key={remaining}
          >
            {remaining <= 5 && remaining > 0 ? remaining : timeStr}
          </motion.span>
          {remaining === 0 && (
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-8xl font-black text-red-500 block mt-4"
            >
              TIME!
            </motion.span>
          )}
        </motion.div>

        {/* Turn score */}
        <div className="text-center">
          <p className="text-lg text-gray-500 uppercase tracking-wider mb-2">This Turn</p>
          <motion.span
            key={state.turnScore}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-7xl font-black tabular-nums"
            style={{ color: activeTeam?.color }}
          >
            {state.turnScore}
          </motion.span>
        </div>
      </div>

      {/* Bottom: mini scoreboard */}
      <div className="fixed bottom-0 left-0 right-0 p-6">
        <div className="flex justify-center gap-6">
          {state.teams.map((t) => {
            const p = GAME_PIECES.find((gp) => gp.id === t.pieceId);
            const isActive = t.id === state.activeTeamId;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
                  isActive ? 'bg-white/15 ring-1 ring-white/30' : 'bg-white/5'
                }`}
              >
                <span>{p?.emoji}</span>
                <span className="font-semibold">{t.name}</span>
                <span className="text-gray-400 tabular-nums">{t.boardPosition}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Turn Review ────────────────────────────────────────────────

function DisplayReview({ state }: { state: PublicDisplayState }) {
  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-8"
    >
      <div className="text-center space-y-8">
        <motion.p
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-2xl text-gray-400 uppercase tracking-widest font-bold"
        >
          Round Complete
        </motion.p>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">{GAME_PIECES.find((p) => p.id === activeTeam?.pieceId)?.emoji}</span>
            <span className="text-3xl font-bold" style={{ color: activeTeam?.color }}>
              {activeTeam?.name}
            </span>
          </div>

          <p className="text-xl text-gray-500">Provisional score</p>
          <motion.span
            className="text-9xl font-black tabular-nums block"
            style={{ color: activeTeam?.color }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {state.turnScore}
          </motion.span>

          <p className="text-lg text-gray-500 animate-pulse">Confirming results...</p>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Piece Moving ───────────────────────────────────────────────

function DisplayPieceMoving({ state }: { state: PublicDisplayState }) {
  const [currentAnimStep, setCurrentAnimStep] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const animStartedRef = useRef(false);
  const prevPathRef = useRef<string>('');

  const animatingTeam = state.teams.find((t) => t.id === state.animatingTeamId);
  const piece = animatingTeam ? GAME_PIECES.find((p) => p.id === animatingTeam.pieceId) : null;
  const catMeta = animatingTeam
    ? CATEGORY_META[state.boardSpaces[Math.min(animatingTeam.boardPosition, state.boardSpaces.length - 1)]?.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.RANDOM
    : CATEGORY_META.RANDOM;

  // The position the piece is visually at during animation
  const visualPosition = state.animationPath.length > 0
    ? (currentAnimStep < state.animationPath.length ? state.animationPath[currentAnimStep] : state.animationPath[state.animationPath.length - 1])
    : animatingTeam?.boardPosition ?? 0;

  const spacesToMove = state.animationPath.length;

  // Animate step by step
  useEffect(() => {
    const pathKey = state.animationPath.join(',');
    if (pathKey === prevPathRef.current) return;
    prevPathRef.current = pathKey;
    animStartedRef.current = false;
    setCurrentAnimStep(0);
    setAnimationDone(false);

    if (state.animationPath.length === 0) {
      setAnimationDone(true);
      return;
    }

    animStartedRef.current = true;
    let step = 0;
    const totalSteps = state.animationPath.length;
    const maxTotalTime = 4000;
    const perStep = Math.max(50, Math.min(200, maxTotalTime / totalSteps));

    function advance() {
      if (step >= totalSteps) {
        setAnimationDone(true);
        return;
      }
      setCurrentAnimStep(step);
      step++;
      setTimeout(advance, perStep);
    }

    setTimeout(advance, 600);
  }, [state.animationPath]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6"
    >
      {/* Confirmed score banner */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-6"
      >
        <span className="text-2xl font-bold" style={{ color: animatingTeam?.color }}>
          {spacesToMove} Space{spacesToMove !== 1 ? 's' : ''} Confirmed
        </span>
      </motion.div>

      {/* Board */}
      <div className="w-full max-w-[850px] mx-auto">
        <GameBoard
          spaces={state.boardSpaces}
          teams={state.teams as any}
          settings={state.settings as any}
          highlightSpace={visualPosition}
          animatingTeamId={state.animatingTeamId}
          animatingPosition={visualPosition}
        />
      </div>

      {/* Landing info */}
      <AnimatePresence>
        {animationDone && animatingTeam && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mt-8 space-y-4"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">{piece?.emoji}</span>
              <span className="text-2xl font-bold" style={{ color: animatingTeam.color }}>
                {animatingTeam.name}
              </span>
              <span className="text-xl text-gray-400">moved {spacesToMove} spaces</span>
            </div>

            {animatingTeam.boardPosition < state.boardSpaces.length ? (
              <div>
                <p className="text-lg text-gray-500 mb-2">Landed on</p>
                <span
                  className="inline-block px-8 py-3 rounded-2xl text-2xl font-bold text-white"
                  style={{ backgroundColor: catMeta.bg }}
                >
                  {state.currentCategoryLabel}
                </span>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-4xl font-extrabold text-amber-500"
              >
                Reached the finish line!
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Game Over ──────────────────────────────────────────────────

function DisplayGameOver({ state }: { state: PublicDisplayState }) {
  const MEDALS = ['🥇', '🥈', '🥉'];
  const finishedSet = new Set(state.finishedTeamIds);

  // Build placement order
  const sortedTeams = [
    ...state.finishedTeamIds.map((id) => state.teams.find((t) => t.id === id)!).filter(Boolean),
    ...state.teams
      .filter((t) => !finishedSet.has(t.id))
      .sort((a, b) => b.boardPosition - a.boardPosition),
  ];

  const winner = sortedTeams[0];
  const winnerPiece = winner ? GAME_PIECES.find((p) => p.id === winner.pieceId) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-8"
    >
      {/* Background board (faded) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <div className="w-full max-w-[800px]">
          <GameBoard
            spaces={state.boardSpaces}
            teams={state.teams as any}
            settings={state.settings as any}
          />
        </div>
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center space-y-10 relative z-10 max-w-lg w-full"
      >
        {/* Trophy */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-8xl"
        >
          {state.isDraw ? '🤝' : '🏆'}
        </motion.div>

        {/* Winner announcement */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-5xl sm:text-6xl font-extrabold"
          style={{ color: state.isDraw ? '#fff' : winner?.color }}
        >
          {state.isDraw
            ? 'Draw!'
            : `${winnerPiece?.emoji} ${winner?.name} Wins!`}
        </motion.h1>

        {/* Final standings */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          <p className="text-sm text-gray-500 uppercase tracking-widest font-bold mb-4">Final Standings</p>
          {sortedTeams.map((team, i) => {
            const piece = GAME_PIECES.find((p) => p.id === team.pieceId);
            const isFinished = finishedSet.has(team.id);
            let medal = '';
            if (state.isDraw && isFinished) {
              medal = '🏆';
            } else if (!state.isDraw && i < MEDALS.length) {
              medal = MEDALS[i];
            }

            return (
              <motion.div
                key={team.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-2xl ${
                  (state.isDraw && isFinished) || (!state.isDraw && i === 0)
                    ? 'bg-amber-500/20 ring-1 ring-amber-500/40'
                    : 'bg-white/5'
                }`}
              >
                <span className="text-2xl w-10 text-center">{medal}</span>
                <span className="text-xl">{piece?.emoji}</span>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                <div className="flex-1 text-left">
                  <p className="font-bold text-lg">{team.name}</p>
                  <p className="text-xs text-gray-500">
                    {team.playerNames.join(', ')}
                  </p>
                </div>
                <span className="text-lg font-extrabold tabular-nums">
                  {isFinished ? 'Finished' : `Space ${team.boardPosition}`}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
