let audioCtx = null;
let masterGain = null;
let tickInterval = null;
let unlocked = false;
let isMuted = localStorage.getItem('gameMuted') === 'true';

const unlock = () => {
  if (unlocked) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  masterGain.gain.value = isMuted ? 0 : 1;

  // Safari silent buffer unlock — must happen inside user gesture
  const buffer = audioCtx.createBuffer(1, 1, 22050);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0);
  source.onended = () => {
    unlocked = true;
    console.log('[AUDIO] Safari unlocked. State:', audioCtx.state);
  };

  audioCtx.resume().then(() => {
    console.log('[AUDIO] Context resumed. State:', audioCtx.state);
  });
};

// Attach unlock to every possible first gesture
['click', 'touchstart', 'touchend', 'keydown', 'mousedown'].forEach(evt => {
  document.addEventListener(evt, unlock, { once: false });
});

const playTone = (frequency, duration, gain) => {
  if (!audioCtx || audioCtx.state !== 'running') {
    console.warn('[AUDIO] Context not running. State:', audioCtx?.state);
    return;
  }

  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(masterGain);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration
    );

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);

    osc.onended = () => {
      osc.disconnect();
      gainNode.disconnect();
    };

    console.log('[AUDIO] Played tone:', frequency, 'Hz');
  } catch (e) {
    console.error('[AUDIO] playTone error:', e);
  }
};

export const startCountdown = (secondsRemaining) => {
  stopCountdown();
  console.log('[AUDIO] startCountdown:', secondsRemaining);

  let current = secondsRemaining;

  const tick = () => {
    if (current <= 0) {
      stopCountdown();
      return;
    }
    if (current > 5)       playTone(800,  0.08, 0.4);
    else if (current > 1)  playTone(1000, 0.06, 0.6);
    else if (current === 1) playTone(1200, 0.04, 0.9);
    current--;
  };

  tick();
  tickInterval = setInterval(tick, 1000);
};

export const stopCountdown = () => {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
};

export const playTimeUp = () => {
  stopCountdown();
  if (!audioCtx) return;
  [600, 400, 250].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, 0.7), i * 130);
  });
};

export const toggleMute = () => {
  isMuted = !isMuted;
  localStorage.setItem('gameMuted', String(isMuted));
  if (masterGain) masterGain.gain.value = isMuted ? 0 : 1;
  return isMuted;
};

export const initAudio = () => unlock();
