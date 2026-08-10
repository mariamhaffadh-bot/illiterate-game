import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  duration: number;
  onTick?: (remaining: number) => void;
  onComplete?: () => void;
  paused?: boolean;
}

export function useTimer({ duration, onTick, onComplete, paused }: UseTimerOptions) {
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);
  const hasCompletedRef = useRef(false);

  onCompleteRef.current = onComplete;
  onTickRef.current = onTick;

  const start = useCallback(() => {
    setRemaining(duration);
    setIsRunning(true);
    hasCompletedRef.current = false;
  }, [duration]);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setRemaining(duration);
    setIsRunning(false);
    hasCompletedRef.current = false;
  }, [duration]);

  useEffect(() => {
    if (!isRunning || paused) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        onTickRef.current?.(next);
        if (next <= 0) {
          clearInterval(interval);
          setIsRunning(false);
          if (!hasCompletedRef.current) {
            hasCompletedRef.current = true;
            // Defer to avoid state updates during render
            setTimeout(() => onCompleteRef.current?.(), 0);
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, paused]);

  const progress = remaining / duration;
  const isUrgent = remaining <= 10;
  const isCritical = remaining <= 5;

  return { remaining, progress, isRunning, isUrgent, isCritical, start, stop, reset };
}
