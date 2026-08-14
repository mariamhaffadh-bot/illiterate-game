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
  /** Skip the frame/perspective wrapper (for inline use in non-board screens) */
  bare?: boolean;
}

// Jewel-tone gradient pairs: [lighter, base, darker, bottom-edge]
const CATEGORY_GRADIENTS: Record<string, { hi: string; lo: string; edge: string }> = {
  ACTION:  { hi: '#E74C3C', lo: '#A93226', edge: '#7B241C' },
  OBJECT:  { hi: '#2E86C1', lo: '#1F618D', edge: '#1A5276' },
  NATURE:  { hi: '#27AE60', lo: '#1E8449', edge: '#145A32' },
  RANDOM:  { hi: '#A569BD', lo: '#7D3C98', edge: '#512E5F' },
  PERSON:  { hi: '#F1C40F', lo: '#D4A017', edge: '#9A7D0A' },
  WORLD:   { hi: '#1ABC9C', lo: '#117A65', edge: '#0B5345' },
  SPADE:   { hi: '#2E4053', lo: '#1A5276', edge: '#0E2F44' },
};

export function GameBoard({
  spaces,
  teams,
  settings,
  highlightSpace,
  animatingTeamId,
  animatingPosition,
  className = '',
  bare = false,
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
      if (animatingTeamId === team.id && animatingPosition !== undefined) {
        pos = animatingPosition;
      }
      const clamped = Math.min(pos, spaces.length - 1);
      if (!map.has(clamped)) map.set(clamped, []);
      map.get(clamped)!.push(team);
    }
    return map;
  }, [teams, spaces.length, animatingTeamId, animatingPosition]);

  const boardSvg = (
    <svg
      viewBox="0 0 1000 1000"
      className={`w-full h-full ${className}`}
      style={{ maxHeight: '100%', maxWidth: '100%' }}
    >
      {/* ── SVG Definitions ── */}
      <defs>
        {/* Category gradients */}
        {Object.entries(CATEGORY_GRADIENTS).map(([cat, colors]) => (
          <linearGradient key={cat} id={`grad-${cat}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.hi} />
            <stop offset="100%" stopColor={colors.lo} />
          </linearGradient>
        ))}

        {/* Title gradient */}
        <linearGradient id="title-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        {/* Drop shadow filter for segments */}
        <filter id="segment-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
        </filter>

        {/* Glow filter for highlighted spaces */}
        <filter id="space-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Piece shadow */}
        <filter id="piece-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
        </filter>

        {/* Inner glow for center */}
        <radialGradient id="center-fill" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#1e1e30" />
          <stop offset="100%" stopColor="#0f0f1a" />
        </radialGradient>
      </defs>

      {/* ── Outer ring shadow (gives depth to the whole board) ── */}
      <circle cx={500} cy={500} r={440} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={30}
        style={{ filter: 'blur(8px)' }} />

      {/* ── Board ring segments ── */}
      {spaces.map((space, i) => {
        const geo = geometry[i];
        const gradColors = CATEGORY_GRADIENTS[space.category] ?? CATEGORY_GRADIENTS.SPADE;
        const isHighlighted = highlightSpace === i;
        const isStart = space.type === 'START';

        return (
          <g key={i}>
            {/* Bottom edge (3D raised effect) — offset slightly down */}
            <path
              d={geo.path}
              fill={gradColors.edge}
              transform="translate(0, 5)"
              opacity={0.8}
            />

            {/* Main segment with gradient */}
            <motion.path
              d={geo.path}
              fill={`url(#grad-${space.category})`}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
              filter={isHighlighted ? 'url(#space-glow)' : undefined}
              opacity={isHighlighted ? 1 : 0.92}
              animate={isHighlighted ? {
                opacity: [0.92, 1, 0.92],
              } : {}}
              transition={isHighlighted ? { duration: 1.5, repeat: Infinity } : {}}
            />

            {/* Inner highlight edge (top light reflection) */}
            <path
              d={geo.path}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              style={{ pointerEvents: 'none' }}
            />

            {/* Category label */}
            <text
              x={geo.center.x}
              y={geo.center.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={isStart ? 12 : 10}
              fontWeight={isStart ? 900 : 800}
              fontFamily="Nunito, sans-serif"
              letterSpacing={isStart ? 2 : 0.5}
              style={{
                pointerEvents: 'none',
                textShadow: '0 2px 4px rgba(0,0,0,0.6)',
              }}
              transform={`rotate(${geo.centerAngle}, ${geo.center.x}, ${geo.center.y})`}
            >
              {isStart
                ? 'START'
                : space.category === 'SPADE'
                  ? '♠'
                  : (settings ? getCategoryLabel(space.category, settings) : CATEGORY_META[space.category].label).slice(0, 3).toUpperCase()
              }
            </text>
          </g>
        );
      })}

      {/* ── Finish line indicator ── */}
      <text
        x={500} y={252}
        textAnchor="middle"
        fill="rgba(255,255,255,0.5)"
        fontSize={11}
        fontWeight={800}
        fontFamily="Nunito, sans-serif"
        letterSpacing={3}
      >
        FINISH
      </text>

      {/* ── Center area ── */}
      {/* Dark inner circle with subtle glow */}
      <circle cx={500} cy={500} r={290} fill="#0a0a14" />
      <circle cx={500} cy={500} r={288} fill="url(#center-fill)" />

      {/* Decorative ring */}
      <circle cx={500} cy={500} r={282} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      <circle cx={500} cy={500} r={260} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={1} />

      {/* Center logo */}
      <text
        x={500} y={495}
        textAnchor="middle"
        fontSize={38}
        fontWeight={900}
        fontFamily="'Fredoka One', cursive"
        letterSpacing={-1}
      >
        <tspan fill="rgba(255,255,255,0.9)">Illi</tspan>
        <tspan fill="url(#title-gradient)">terate</tspan>
      </text>

      {/* Subtitle */}
      <text
        x={500} y={530}
        textAnchor="middle"
        fontSize={10}
        fontFamily="Nunito, sans-serif"
        fontWeight={600}
        fill="rgba(255,255,255,0.25)"
        letterSpacing={3}
      >
        THE WORD GAME
      </text>

      {/* ── Team pieces ── */}
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
              filter="url(#piece-shadow)"
            >
              {/* Outer glow ring */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={20}
                fill="none"
                stroke={team.color}
                strokeWidth={1.5}
                opacity={isAnimating ? 0.6 : 0.3}
              />
              {/* Piece background circle */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={17}
                fill={team.color}
                stroke="white"
                strokeWidth={3}
                animate={isAnimating ? { r: [17, 22, 17] } : {}}
                transition={isAnimating ? { duration: 0.3 } : {}}
              />
              {/* Inner gradient overlay for 3D effect */}
              <circle
                cx={pos.x}
                cy={pos.y - 2}
                r={10}
                fill="rgba(255,255,255,0.2)"
                style={{ pointerEvents: 'none' }}
              />
              {/* Piece emoji */}
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={15}
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

  if (bare) return boardSvg;

  return (
    <div className="board-perspective">
      <div className="board-tilt">
        <div className="board-frame">
          {boardSvg}
        </div>
      </div>
    </div>
  );
}
