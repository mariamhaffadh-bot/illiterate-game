import { motion } from 'framer-motion';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

const variants = {
  primary:
    'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
  danger:
    'bg-red-500 text-white hover:bg-red-600',
  success:
    'bg-emerald-500 text-white hover:bg-emerald-600',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-base rounded-xl',
  lg: 'px-8 py-4 text-lg rounded-2xl',
  xl: 'px-12 py-5 text-xl font-semibold rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', color, className = '', disabled, children, ...props }, ref) => {
    const style = color
      ? { backgroundColor: color, color: '#fff' }
      : undefined;

    return (
      <motion.button
        ref={ref as any}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        className={`
          ${variants[variant]} ${sizes[size]}
          font-medium transition-colors cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
          select-none touch-manipulation
          ${className}
        `}
        style={style}
        disabled={disabled}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
