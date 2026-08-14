import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { GameBoard } from '../board/GameBoard';
import { TEAM_COLORS, CATEGORY_META, GAME_PIECES, getCategoryLabel } from '../../types';
import { getCurrentDescriber } from '../../engine/game';
import { getCategoryAtPosition } from '../../engine/board';
import { useSound } from '../../hooks/useSound';
import { ensureAudioReady } from '../../engine/audioEngine';

export function TurnIntro() {
  const teams = useGameStore((s) => s.teams);
  const players = useGameStore((s) => s.players);
  const currentTeamIndex = useGameStore((s) => s.currentTeamIndex);
  const boardSpaces = useGameStore((s) => s.boardSpaces);
  const settings = useGameStore((s) => s.settings);
  const startTurn = useGameStore((s) => s.startTurn);
  const redemptionMode = useGameStore((s) => s.redemptionMode);
  const playingForPlacements = useGameStore((s) => s.playingForPlacements);

  const [countdown, setCountdown] = useState<number | null>(null);
  const { play } = useSound();

  const team = teams[currentTeamIndex];
  const describer = getCurrentDescriber(team, players);
  const tc = TEAM_COLORS[currentTeamIndex % TEAM_COLORS.length];
  const category = getCategoryAtPosition(boardSpaces, team.boardPosition);
  const catMeta = CATEGORY_META[category];
  const piece = GAME_PIECES.find((p) => p.id === team.pieceId);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      startTurn();
      return;
    }
    play('countdown');
    const timeout = setTimeout(() => setCountdown(countdown - 1), 800);
    return () => clearTimeout(timeout);
  }, [countdown, startTurn, play]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col lg:flex-row"
    >
      {/* Board (visible on larger screens) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-8 table-surface relative">
        <div className="w-full max-w-[900px] relative z-10">
          <GameBoard
            spaces={boardSpaces}
            teams={teams}
            settings={settings}
            highlightSpace={team.boardPosition}
          />
        </div>
      </div>

      {/* Turn info */}
      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {countdown === null ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6 max-w-sm w-full"
            >
              {redemptionMode && !playingForPlacements && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4"
                >
                  <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-red-500 text-white text-sm font-extrabold uppercase tracking-wider">
                    Redemption Round
                  </span>
                </motion.div>
              )}
              {playingForPlacements && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4"
                >
                  <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-violet-500 text-white text-sm font-extrabold uppercase tracking-wider">
                    Playing for Placements
                  </span>
                </motion.div>
              )}
              <p className="text-lg text-gray-400 uppercase tracking-wider font-medium">
                Pass the device to
              </p>

              <div className="space-y-2">
                <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 dark:text-white">
                  {describer?.name ?? 'Unknown'}
                </h1>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">{piece?.emoji}</span>
                  <span
                    className="px-4 py-1.5 rounded-xl text-base font-bold text-white"
                    style={{ backgroundColor: tc.bg }}
                  >
                    {team.name}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-sm text-gray-400">You're on</p>
                <div
                  className="category-tile category-tile-raised inline-flex items-center gap-2 px-6 py-3 text-2xl category-glow"
                  style={{
                    background: `linear-gradient(135deg, ${catMeta.color}, ${catMeta.bg})`,
                    '--tile-dark': catMeta.dark,
                    '--glow-color': catMeta.bg,
                  } as React.CSSProperties}
                >
                  {category === 'SPADE' ? `${catMeta.icon} Spade` : `${catMeta.icon} ${getCategoryLabel(category, settings)}`}
                </div>
                {category === 'SPADE' && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">
                    Find the ♠ on each card and <strong>act out</strong> that word — no talking!
                  </p>
                )}
              </div>

              <div className="pt-6">
                <Button size="xl" onClick={() => { ensureAudioReady(); setCountdown(3); }} color={tc.bg}>
                  Start Turn
                </Button>
              </div>

              {/* Mini scoreboard */}
              <div className="pt-6 space-y-1.5">
                {teams
                  .slice()
                  .sort((a, b) => b.boardPosition - a.boardPosition)
                  .map((t) => {
                    const tIdx = teams.indexOf(t);
                    const color = TEAM_COLORS[tIdx % TEAM_COLORS.length];
                    const p = GAME_PIECES.find((gp) => gp.id === t.pieceId);
                    return (
                      <div key={t.id} className="flex items-center justify-center gap-3 text-sm">
                        <span>{p?.emoji}</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color.bg }} />
                        <span className="text-gray-600 dark:text-gray-400 w-28 text-left">{t.name}</span>
                        <span className="font-bold text-gray-900 dark:text-white tabular-nums w-12 text-right">
                          Space {t.boardPosition}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="countdown" className="flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={countdown}
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-8xl sm:text-9xl font-black"
                  style={{ color: countdown === 0 ? tc.bg : undefined }}
                >
                  {countdown === 0 ? 'GO!' : countdown}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
