import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { computeBoardGeometry, getPiecePositions } from '../../engine/board';
import type { BoardSpace, GameSettings, Team } from '../../types';
import { CATEGORY_META, GAME_PIECES, getCategoryLabel } from '../../types';

interface GameBoardProps {
  spaces: BoardSpace[];
  teams: Team[];
  settings?: GameSettings;
  highlightSpace?: number;
  animatingTeamId?: string | null;
  animatingPosition?: number;
  className?: string;
}

export function GameBoard({
  spaces,
  teams,
  settings,
  highlightSpace,
  animatingTeamId,
  animatingPosition,
  className = '',
}: GameBoardProps) {
  const geometry = useMemo(
    () => computeBoardGeometry(spaces.length, 500, 500, 300, 430),
    [spaces.length]
  );

  // Build a map of space index -> teams on that space
  const teamsAtSpace = useMemo(() => {
    const map = new Map<number, Team[]>();
    for (const team of teams) {
      let pos = team.boardPosition;
      // If this team is animating, use the animated position instead
      if (animatingTeamId === team.id && animatingPosition !== undefined) {
        pos = animatingPosition;
      }
      const clamped = Math.min(pos, spaces.length - 1);
      if (!map.has(clamped)) map.set(clamped, []);
      map.get(clamped)!.push(team);
    }
    return map;
  }, [teams, spaces.length, animatingTeamId, animatingPosition]);

  return (
    <svg
      viewBox="0 0 1000 1000"
      className={`w-full h-full ${className}`}
      style={{ maxHeight: '100%', maxWidth: '100%' }}
    >
      {/* Board ring segments */}
      {spaces.map((space, i) => {
        const geo = geometry[i];
        const meta = CATEGORY_META[space.category];
        const isHighlighted = highlightSpace === i;
        const isStart = space.type === 'START';

        return (
          <g key={i}>
            {/* Space segment */}
            <motion.path
              d={geo.path}
              fill={meta.bg}
              stroke="#ffffff"
              strokeWidth={2}
              opacity={isHighlighted ? 1 : 0.85}
              animate={isHighlighted ? {
                opacity: [0.85, 1, 0.85],
                filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'],
              } : {}}
              transition={isHighlighted ? { duration: 1.5, repeat: Infinity } : {}}
              style={{ filter: isHighlighted ? 'brightness(1.2)' : 'none' }}
            />

            {/* Category label */}
            <text
              x={geo.center.x}
              y={geo.center.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={isStart ? 11 : 9}
              fontWeight={isStart ? 800 : 600}
              style={{
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
              }}
              transform={`rotate(${geo.centerAngle}, ${geo.center.x}, ${geo.center.y})`}
            >
              {isStart ? 'START' : space.category === 'SPADE' ? '♠' : (settings ? getCategoryLabel(space.category, settings) : meta.label).slice(0, 3).toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Finish line indicator at the top */}
      <text
        x={500}
        y={254}
        textAnchor="middle"
        fill="#9CA3AF"
        fontSize={12}
        fontWeight={700}
        letterSpacing={2}
      >
        FINISH
      </text>

      {/* Center decoration */}
      <circle cx={500} cy={500} r={285} fill="white" className="dark:fill-gray-900" />
      <circle cx={500} cy={500} r={280} fill="none" stroke="#E5E7EB" strokeWidth={1} className="dark:stroke-gray-700" />

      {/* Center text */}
      <text
        x={500}
        y={505}
        textAnchor="middle"
        fontSize={34}
        fontWeight={800}
        style={{ letterSpacing: '-1px' }}
      >
        <tspan fill="#111827" className="dark:fill-white">Illi</tspan>
        <tspan fill="url(#gradient)">terate</tspan>
      </text>

      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>

      {/* Team pieces */}
      {spaces.map((_, i) => {
        const teamsHere = teamsAtSpace.get(i) || [];
        if (teamsHere.length === 0) return null;

        const geo = geometry[i];
        const positions = getPiecePositions(geo.center, teamsHere.length, geo.centerAngle);

        return teamsHere.map((team, ti) => {
          const pos = positions[ti];
          const piece = GAME_PIECES.find((p) => p.id === team.pieceId);
          const isAnimating = animatingTeamId === team.id;

          return (
            <motion.g
              key={team.id}
              initial={false}
              animate={{ x: 0, y: 0 }}
            >
              {/* Piece background circle */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={16}
                fill={team.color}
                stroke="white"
                strokeWidth={2.5}
                animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
                transition={isAnimating ? { duration: 0.3 } : {}}
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
              />
              {/* Piece emoji */}
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                style={{ pointerEvents: 'none' }}
              >
                {piece?.emoji ?? '⭐'}
              </text>
            </motion.g>
          );
        });
      })}
    </svg>
  );
}
