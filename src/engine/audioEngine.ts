/**
 * Web Audio API sound engine for countdown ticks.
 * Zero dependencies — all sounds synthesised via OscillatorNode + GainNode.
 * Uses a single shared AudioContext, lazily initialised on first user gesture.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
let currentSecond = 0;

const STORAGE_KEY = 'wordparty_muted';

function getCtx(): AudioContext {
  if (!ctx) {
    const ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)() as AudioContext;
    const mg = ac.createGain();
    mg.connect(ac.destination);
    // Restore mute preference
    try {
      const muted = localStorage.getItem(STORAGE_KEY) === '1';
      mg.gain.value = muted ? 0 : 1;
    } catch { /* noop */ }

    ctx = ac;
    masterGain = mg;

    // Safari fix: one-time unlock on the very first user gesture
    const unlockAudio = () => {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    };
    ['click', 'touchstart', 'keydown'].forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true });
    });
  }

  // Always try to resume when accessed
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

function getMasterGain(): GainNode {
  getCtx();
  return masterGain!;
}

// ── Tick sounds ──────────────────────────────────────────────────

function playTone(frequency: number, duration: number, gain: number, type: OscillatorType = 'sine') {
  const c = getCtx();
  console.log('[AUDIO] playTone', frequency, 'Hz, gain', gain, 'ctx.state:', c.state);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(getMasterGain());

  osc.frequency.value = frequency;
  osc.type = type;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);

  // Clean up to avoid memory leaks
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function tickForSecond(s: number) {
  if (s >= 6) {
    // 10 → 6: clean moderate tick
    playTone(800, 0.08, 0.3);
  } else if (s >= 2) {
    // 5 → 2: sharper, higher, with subtle sub-harmonic
    playTone(1000, 0.06, 0.5);
    playTone(400, 0.06, 0.1);   // subtle harmonic layer
  } else if (s === 1) {
    // Final tick: loud and sharp
    playTone(1200, 0.04, 0.8);
  }
  // s === 0 is handled by playTimeUp(), not a tick
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Start the countdown ticking. Call when timer hits 10 seconds.
 * Plays a tick immediately for the current second, then every 1s.
 */
export function startCountdown(secondsRemaining: number) {
  console.log('[AUDIO] startCountdown called with', secondsRemaining);
  stopCountdown(); // clear any existing countdown
  currentSecond = secondsRemaining;

  if (currentSecond > 0) {
    tickForSecond(currentSecond);
  }

  tickInterval = setInterval(() => {
    currentSecond--;
    if (currentSecond <= 0) {
      stopCountdown();
      return;
    }
    tickForSecond(currentSecond);
  }, 1000);
}

/**
 * Stop the countdown ticking. Call on correct answer or when timer ends.
 */
export function stopCountdown() {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  currentSecond = 0;
}

/**
 * Play the "time's up" descending three-tone sound.
 * 600Hz → 400Hz → 250Hz, each 120ms.
 */
export function playTimeUp() {
  console.log('[AUDIO] playTimeUp called');
  const c = getCtx();
  const tones = [600, 400, 250];
  const duration = 0.12;
  const gain = 0.6;

  tones.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(getMasterGain());

    osc.frequency.value = freq;
    osc.type = 'sine';
    const startTime = c.currentTime + i * duration;
    g.gain.setValueAtTime(gain, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);

    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  });
}

// ── Mute toggle ──────────────────────────────────────────────────

export function isMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  getMasterGain().gain.value = muted ? 0 : 1;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch { /* noop */ }
}

export function toggleMute(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

/**
 * Ensure AudioContext is initialised and resumed.
 * Call from any user gesture handler to satisfy browser autoplay policy.
 */
export function ensureAudioReady() {
  const c = getCtx();
  console.log('[AUDIO] ensureAudioReady, ctx.state:', c.state, 'masterGain:', masterGain?.gain.value);
}
