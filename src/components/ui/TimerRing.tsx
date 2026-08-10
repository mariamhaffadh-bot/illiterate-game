import { motion } from 'framer-motion';

interface TimerRingProps {
  remaining: number;
  total: number;
  isUrgent: boolean;
  isCritical: boolean;
  size?: number;
}

export function TimerRing({ remaining, total, isUrgent, isCritical, size = 120 }: TimerRingProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / total;
  const dashOffset = circumference * (1 - progress);

  const color = isCritical
    ? '#EF4444'
    : isUrgent
    ? '#F59E0B'
    : '#22C55E';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </svg>
      <motion.span
        className={`absolute font-bold tabular-nums ${
          isCritical ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-gray-900 dark:text-white'
        }`}
        style={{ fontSize: size * 0.3 }}
        animate={isCritical ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity }}
      >
        {remaining}
      </motion.span>
    </div>
  );
}
