import { motion } from 'framer-motion';

interface PlayerBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  onRemove?: () => void;
  onClick?: () => void;
  draggable?: boolean;
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function PlayerBadge({ name, color, size = 'md', onRemove, onClick, draggable }: PlayerBadgeProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full
        bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        ${onClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}
        select-none
      `}
      onClick={onClick}
    >
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
        {name}
      </span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-400 flex items-center justify-center text-xs text-gray-500 transition-colors cursor-pointer"
        >
          ×
        </button>
      )}
    </motion.div>
  );
}
