import { useCallback, useEffect, useRef, useState } from 'react';

/** A loud two-tone siren generated with the Web Audio API — no audio file needed, works offline. */
export function useAlarm() {
  const ctxRef = useRef(null);
  const [on, setOn] = useState(false);

  const stop = useCallback(() => {
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setOn(false);
  }, []);

  const start = useCallback(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || ctxRef.current) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 950;
    lfo.type = 'triangle';
    lfo.frequency.value = 1.4;
    lfoGain.gain.value = 380;
    gain.gain.value = 0.18;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    lfo.start();
    ctxRef.current = ctx;
    setOn(true);
  }, []);

  useEffect(() => stop, [stop]);
  return { on, start, stop, toggle: () => (ctxRef.current ? stop() : start()) };
}
