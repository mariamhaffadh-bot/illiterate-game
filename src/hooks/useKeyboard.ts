import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

export function useKeyboard(handlers: Record<string, KeyHandler>, deps: unknown[] = []) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const handler = handlers[e.key] || handlers[e.code];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, deps);
}
