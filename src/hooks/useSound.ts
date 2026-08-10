import { useCallback, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

// Simple audio synthesis for game sounds
function createBeep(frequency: number, duration: number, volume: number = 0.3): () => void {
  return () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available
    }
  };
}

function createChime(): () => void {
  return () => {
    try {
      const ctx = new AudioContext();
      const frequencies = [523, 659, 784];
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.2;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3 + i * 0.1);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + 0.3 + i * 0.1);
      });
    } catch {
      // Audio not available
    }
  };
}

function createBuzzer(): () => void {
  return () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 200;
      osc.type = 'square';
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not available
    }
  };
}

const sounds = {
  tick: createBeep(800, 0.1, 0.15),
  correct: createChime(),
  pass: createBeep(300, 0.15, 0.1),
  timeWarning: createBeep(600, 0.2, 0.2),
  timeUp: createBuzzer(),
  countdown: createBeep(440, 0.15, 0.2),
  victory: createChime(),
};

export type SoundName = keyof typeof sounds;

export function useSound() {
  const soundEnabled = useGameStore((s) => s.settings.soundEnabled);
  const lastPlayedRef = useRef<Record<string, number>>({});

  const play = useCallback(
    (name: SoundName) => {
      if (!soundEnabled) return;
      // Debounce to avoid rapid-fire
      const now = Date.now();
      const last = lastPlayedRef.current[name] || 0;
      if (now - last < 100) return;
      lastPlayedRef.current[name] = now;
      sounds[name]();
    },
    [soundEnabled]
  );

  return { play };
}
