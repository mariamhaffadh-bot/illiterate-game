import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { GameBoard } from '../board/GameBoard';
import { TEAM_COLORS, CATEGORY_META, GAME_PIECES } from '../../types';
import { getCategoryAtPosition } from '../../engine/board';
import { useSound } from '../../hooks/useSound';

export function PieceMoving() {
  const teams = useGameStore((s) => s.teams);
  const boardSpaces = useGameStore((s) => s.boardSpaces);
  const settings = useGameStore((s) => s.settings);
  const animatingTeamId = useGameStore((s) => s.animatingTeamId);
  const animationPath = useGameStore((s) => s.animationPath);
  const finishPieceAnimation = useGameStore((s) => s.finishPieceAnimation);
  const turnHistory = useGameStore((s) => s.turnHistory);
  const { play } = useSound();

  const [currentAnimStep, setCurrentAnimStep] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const animStartedRef = useRef(false);

  const animatingTeam = teams.find((t) => t.id === animatingTeamId);
  const lastTurn = turnHistory[turnHistory.length - 1];
  const teamIdx = animatingTeam ? teams.indexOf(animatingTeam) : 0;
  const tc = TEAM_COLORS[teamIdx % TEAM_COLORS.length];
  const piece = animatingTeam ? GAME_PIECES.find((p) => p.id === animatingTeam.pieceId) : null;

  // The position the piece is visually at during animation
  const visualPosition = animationPath.length > 0
    ? (currentAnimStep < animationPath.length ? animationPath[currentAnimStep] : animationPath[animationPath.length - 1])
    : animatingTeam?.boardPosition ?? 0;

  // Landing category (after animation finishes)
  const landingPosition = animatingTeam?.boardPosition ?? 0;
  const landingCategory = getCategoryAtPosition(boardSpaces, Math.min(landingPosition, boardSpaces.length - 1));
  const landingMeta = CATEGORY_META[landingCategory];

  // Animate step by step
  useEffect(() => {
    if (animStartedRef.current) return;
    if (animationPath.length === 0) {
      setAnimationDone(true);
      return;
    }
    animStartedRef.current = true;

    let step = 0;
    const totalSteps = animationPath.length;
    // Scale speed based on total steps so animation never drags
    // Short moves (~5): ~200ms per step. Long moves (40+): ~60ms per step.
    const maxTotalTime = 4000; // cap total animation at 4 seconds
    const perStep = Math.max(50, Math.min(200, maxTotalTime / totalSteps));

    function advance() {
      if (step >= totalSteps) {
        setAnimationDone(true);
        return;
      }
      setCurrentAnimStep(step);
      play('tick');
      step++;
      setTimeout(advance, perStep);
    }

    // Small initial delay before starting
    setTimeout(advance, 400);
  }, [animationPath, play]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 table-surface"
    >
      {/* Board */}
      <div className="w-full max-w-[900px] mx-auto relative z-10">
        <GameBoard
          spaces={boardSpaces}
          teams={teams}
          settings={settings}
          highlightSpace={visualPosition}
          animatingTeamId={animatingTeamId}
          animatingPosition={visualPosition}
        />
      </div>

      {/* Landing info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: animationDone ? 1 : 0, y: animationDone ? 0 : 20 }}
        transition={{ delay: 0.3 }}
        className="text-center mt-6 space-y-4"
      >
        {animationDone && (
          <>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{piece?.emoji}</span>
              <span className="text-lg font-bold" style={{ color: tc.bg }}>
                {animatingTeam?.name}
              </span>
              <span className="text-gray-300">moved {lastTurn?.confirmedScore ?? 0} spaces</span>
            </div>

            {landingPosition < boardSpaces.length ? (
              <div>
                <p className="text-sm text-gray-300 mb-1">Landed on</p>
                <span
                  className="inline-block px-6 py-2 rounded-xl text-xl font-bold text-white"
                  style={{ backgroundColor: landingMeta.bg }}
                >
                  {landingMeta.label}
                </span>
              </div>
            ) : (
              <div className="text-2xl font-extrabold text-amber-500">
                Reached the finish line!
              </div>
            )}

            <div className="pt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.02 }}
                onClick={finishPieceAnimation}
                className="px-10 py-4 rounded-2xl text-lg font-bold text-white cursor-pointer touch-manipulation"
                style={{ backgroundColor: tc.bg }}
              >
                Continue
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
