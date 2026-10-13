let audioCtx = null;
let sirenOsc = null;
let lfoOsc = null;
let sirenGain = null;
let isPlaying = false;

function getContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') {
    return ctx.resume();
  }
  return Promise.resolve();
}

/**
 * Start the Web Audio emergency siren.
 * Two-tone frequency modulated between ~700 Hz and ~1150 Hz.
 */
export function startSiren() {
  if (isPlaying) return;
  const ctx = getContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    // LFO frequency modulation (sweeps between 700 and 1150 Hz ~ 1.5 times per second)
    lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(1.5, ctx.currentTime);
    lfoGain.gain.setValueAtTime(320, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    lfo.start();

    sirenOsc = osc;
    lfoOsc = lfo;
    sirenGain = gain;
    isPlaying = true;
  } catch (err) {
    console.warn('Could not start siren:', err);
  }
}

/**
 * Stop the emergency siren.
 */
export function stopSiren() {
  if (!isPlaying) return;
  try {
    if (sirenGain && audioCtx) {
      sirenGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    }
    setTimeout(() => {
      try {
        sirenOsc?.stop();
        lfoOsc?.stop();
        sirenOsc?.disconnect();
        lfoOsc?.disconnect();
        sirenGain?.disconnect();
      } catch {}
      sirenOsc = null;
      lfoOsc = null;
      sirenGain = null;
      isPlaying = false;
    }, 100);
  } catch {
    isPlaying = false;
  }
}

export function isSirenActive() {
  return isPlaying;
}
