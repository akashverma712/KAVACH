import { useEffect, useRef, useState } from 'react';

const TRIGGER = /\b(help|bachao|madad)\b/i;

/**
 * Listens for the word "help" (also "bachao" / "madad") using the Web Speech API
 * and calls onDetect. Works in Chrome, Edge and Android Chrome while the app is open.
 */
export function useVoiceTrigger(enabled, onDetect) {
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [heard, setHeard] = useState('');
  const cb = useRef(onDetect);
  cb.current = onDetect;

  useEffect(() => {
    if (!enabled || !SR) return undefined;
    let stopped = false;
    let rec = null;
    let timer = null;
    let backoff = 600;

    const startRec = () => {
      if (stopped) return;
      rec = new SR();
      rec.lang = 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.onstart = () => { setListening(true); setError(null); };
      rec.onresult = (e) => {
        backoff = 600;
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const alts = Array.from(e.results[i]).map((a) => a.transcript.toLowerCase().trim());
          setHeard(alts[0]);
          if (alts.some((t) => TRIGGER.test(t))) {
            cb.current?.();
            try { rec.abort(); } catch { /* ignore */ }
            return;
          }
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          stopped = true;
          setError('Microphone access is blocked. Allow it in your browser settings to use the voice trigger.');
        } else if (e.error === 'network') {
          backoff = 8000;
          setError('Voice trigger needs an internet connection in this browser.');
        } else if (e.error === 'audio-capture') {
          backoff = 5000;
          setError('No microphone was found.');
        }
      };
      rec.onend = () => {
        setListening(false);
        if (!stopped) timer = setTimeout(startRec, backoff);
      };
      try { rec.start(); } catch { timer = setTimeout(startRec, 1500); }
    };

    startRec();
    return () => {
      stopped = true;
      clearTimeout(timer);
      try { rec?.abort(); } catch { /* ignore */ }
      setListening(false);
    };
  }, [enabled, SR]);

  return { supported: Boolean(SR), listening, error, heard };
}
