import type { BoardCategory, BoardSpace, BoardSpaceType } from '../types';
import { BOARD_CATEGORIES } from '../types';

/**
 * Generate the board spaces.
 * Space 0 is the START space, spaces 1..size-1 cycle through the categories.
 * Pass customCategories to override the default category cycle (for custom mode).
 */
export function generateBoard(size: number, customCategories?: BoardCategory[]): BoardSpace[] {
  const cats: BoardCategory[] = customCategories || [...BOARD_CATEGORIES];
  const spaces: BoardSpace[] = [];

  for (let i = 0; i < size; i++) {
    const category: BoardCategory = cats[i % cats.length];
    const type: BoardSpaceType = i === 0 ? 'START' : 'NORMAL';
    spaces.push({ index: i, category, type });
  }

  return spaces;
}

/**
 * Get the category at a given board position.
 */
export function getCategoryAtPosition(spaces: BoardSpace[], position: number): BoardCategory {
  const clamped = Math.max(0, Math.min(position, spaces.length - 1));
  return spaces[clamped].category;
}

/**
 * Calculate new position after moving N spaces.
 * Returns the new position (may exceed board size = win).
 */
export function calculateNewPosition(current: number, spacesToMove: number, _boardSize: number): number {
  return current + spacesToMove;
}

/**
 * Check if a position means the team has won.
 */
export function hasTeamFinished(position: number, boardSize: number): boolean {
  return position >= boardSize;
}

// ── Board Geometry (SVG coordinates) ────────────────────────────

export interface SpaceGeometry {
  index: number;
  // Arc path for the donut segment
  innerArcStart: { x: number; y: number };
  innerArcEnd: { x: number; y: number };
  outerArcStart: { x: number; y: number };
  outerArcEnd: { x: number; y: number };
  // Center point for placing pieces and labels
  center: { x: number; y: number };
  // Angle for text rotation
  centerAngle: number;
  // SVG path string
  path: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90 so 0° is top
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeDonutSegment(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/**
 * Compute the SVG geometry for all board spaces.
 */
export function computeBoardGeometry(
  spaceCount: number,
  cx: number = 500,
  cy: number = 500,
  innerRadius: number = 300,
  outerRadius: number = 430
): SpaceGeometry[] {
  const gapDeg = 1; // gap between spaces in degrees
  const totalDeg = 360;
  const spaceDeg = totalDeg / spaceCount;
  const geometries: SpaceGeometry[] = [];

  for (let i = 0; i < spaceCount; i++) {
    const startAngle = i * spaceDeg + gapDeg / 2;
    const endAngle = (i + 1) * spaceDeg - gapDeg / 2;
    const centerAngle = (startAngle + endAngle) / 2;

    const midR = (innerRadius + outerRadius) / 2;
    const center = polarToCartesian(cx, cy, midR, centerAngle);

    const path = describeDonutSegment(cx, cy, innerRadius, outerRadius, startAngle, endAngle);

    geometries.push({
      index: i,
      innerArcStart: polarToCartesian(cx, cy, innerRadius, startAngle),
      innerArcEnd: polarToCartesian(cx, cy, innerRadius, endAngle),
      outerArcStart: polarToCartesian(cx, cy, outerRadius, startAngle),
      outerArcEnd: polarToCartesian(cx, cy, outerRadius, endAngle),
      center,
      centerAngle,
      path,
    });
  }

  return geometries;
}

/**
 * Get piece positions for teams on the same space.
 * Spreads them out so they don't overlap.
 */
export function getPiecePositions(
  spaceCenter: { x: number; y: number },
  teamCount: number,
  _spaceAngle: number
): { x: number; y: number }[] {
  if (teamCount === 0) return [];
  if (teamCount === 1) return [spaceCenter];

  const radius = 18;
  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < teamCount; i++) {
    const angle = (360 / teamCount) * i - 90;
    const rad = (angle * Math.PI) / 180;
    positions.push({
      x: spaceCenter.x + radius * Math.cos(rad),
      y: spaceCenter.y + radius * Math.sin(rad),
    });
  }

  return positions;
}
