import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceGuard, voiceSupported } from '../lib/voiceGuard';

/**
 * React hook binding for VoiceGuard speech recognition engine.
 */
export function useVoiceGuard({
  enabled = false,
  onMatch,
  lang = 'en-IN',
  fuzzy = true,
  keepAwake = true,
} = {}) {
  const [state, setState] = useState({
    status: 'off',
    heard: '',
    lastMatch: null,
    error: null,
    restarts: 0,
    mode: 'trigger',
    lang,
    wakeLock: false,
  });

  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  const testCallbackRef = useRef(null);

  const guardRef = useRef(null);

  useEffect(() => {
    const guard = new VoiceGuard({
      lang,
      fuzzy,
      keepAwake,
      onState: (s) => setState({ ...s }),
      onMatch: (m) => {
        if (testCallbackRef.current) {
          testCallbackRef.current(m);
        } else {
          onMatchRef.current?.(m);
        }
      },
    });
    guardRef.current = guard;

    return () => {
      guard.stop();
      guardRef.current = null;
    };
  }, [lang, fuzzy, keepAwake]);

  useEffect(() => {
    if (!guardRef.current) return;
    if (enabled) {
      guardRef.current.start().catch(() => {});
    } else {
      guardRef.current.stop();
    }
  }, [enabled]);

  const setMode = useCallback((mode) => {
    guardRef.current?.setMode(mode);
  }, []);

  const start = useCallback(() => {
    return guardRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    guardRef.current?.stop();
  }, []);

  const setTestCallback = useCallback((cb) => {
    testCallbackRef.current = cb;
  }, []);

  return {
    supported: voiceSupported(),
    state,
    listening: state.status === 'listening',
    heard: state.heard,
    lastMatch: state.lastMatch,
    error: state.error,
    mode: state.mode,
    restarts: state.restarts,
    wakeLock: state.wakeLock,
    start,
    stop,
    setMode,
    setTestCallback,
  };
}
