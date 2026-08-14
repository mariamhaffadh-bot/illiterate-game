/**
 * Web Audio API sound engine — Safari-compatible.
 * AudioContext is ONLY created inside a direct user gesture handler.
 * Uses the silent buffer trick to unlock Safari audio.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
let currentSecond = 0;

const STORAGE_KEY = 'wordparty_muted';

/** Play a silent buffer to unlock Safari audio */
function unlockSafariAudio(ac: AudioContext) {
  const buffer = ac.createBuffer(1, 1, 22050);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.connect(ac.destination);
  source.start(0);
}

function getCtx(): AudioContext {
  if (!ctx) {
    const ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)() as AudioContext;
    unlockSafariAudio(ac);

    const mg = ac.createGain();
    mg.connect(ac.destination);
    try {
      const muted = localStorage.getItem(STORAGE_KEY) === '1';
      mg.gain.value = muted ? 0 : 1;
    } catch { /* noop */ }

    ctx = ac;
    masterGain = mg;
  }

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
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
}

function tickForSecond(s: number) {
  if (s >= 6) {
    playTone(800, 0.08, 0.3);
  } else if (s >= 2) {
    playTone(1000, 0.06, 0.5);
    playTone(400, 0.06, 0.1);
  } else if (s === 1) {
    playTone(1200, 0.04, 0.8);
  }
}

// ── Public API ───────────────────────────────────────────────────

export function startCountdown(secondsRemaining: number) {
  stopCountdown();
  currentSecond = secondsRemaining;
  if (currentSecond > 0) tickForSecond(currentSecond);
  tickInterval = setInterval(() => {
    currentSecond--;
    if (currentSecond <= 0) { stopCountdown(); return; }
    tickForSecond(currentSecond);
  }, 1000);
}

export function stopCountdown() {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  currentSecond = 0;
}

export function playTimeUp() {
  const c = getCtx();
  [600, 400, 250].forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(getMasterGain());
    osc.frequency.value = freq;
    osc.type = 'sine';
    const t = c.currentTime + i * 0.12;
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  });
}

// ── Mute ─────────────────────────────────────────────────────────

export function isMuted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
}

export function setMuted(muted: boolean) {
  getMasterGain().gain.value = muted ? 0 : 1;
  try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); }
  catch { /* noop */ }
}

export function toggleMute(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

/**
 * Call from any user gesture (click, tap, keydown) to create and
 * unlock the AudioContext. Must be called from a direct gesture
 * handler for Safari compatibility.
 */
export function ensureAudioReady() {
  getCtx();
}
