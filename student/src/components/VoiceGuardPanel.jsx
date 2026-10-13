import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import { useSos } from '../context/SosContext';

export function VoiceGuardPanel() {
  const {
    voiceOn,
    setVoiceOn,
    voiceGuard,
    soundBeeps,
    setSoundBeeps,
    keepAwake,
    setKeepAwake,
  } = useSos();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const { supported, state, listening, heard, lastMatch, error, restarts, wakeLock } = voiceGuard || {};

  const handleTestVoice = () => {
    if (!voiceOn) setVoiceOn(true);
    setTesting(true);
    setTestResult(null);

    // Set temporary test callback on voiceGuard
    voiceGuard.setTestCallback((match) => {
      setTestResult(match);
      setTesting(false);
      voiceGuard.setTestCallback(null);
    });

    // Auto-timeout test after 12s if nothing heard
    setTimeout(() => {
      setTesting((cur) => {
        if (cur) {
          voiceGuard.setTestCallback(null);
          return false;
        }
        return false;
      });
    }, 12_000);
  };

  if (!supported) {
    return (
      <div className="rounded-control bg-raised p-4 text-sm">
        <div className="flex items-start gap-3">
          <MicOff className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
          <div>
            <p className="font-bold">Voice SOS not supported</p>
            <p className="mt-1 text-muted">
              Voice recognition requires Chrome, Edge or Chrome on Android. Firefox and Brave do not provide the SpeechRecognition API.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-line bg-surface p-5 space-y-4">
      {/* Header and Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            voiceOn && listening ? 'bg-signal/15 text-signal' : 'bg-raised text-muted'
          }`}>
            <Mic className={`h-5 w-5 ${voiceOn && listening ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold">Voice SOS</h3>
              {voiceOn && listening && (
                <span className="flex h-2 w-2 rounded-full bg-signal animate-ping" />
              )}
            </div>
            <p className="text-xs text-muted">
              Say “help” or “bachao” while Kavach is open to trigger SOS hands-free.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={voiceOn}
          onClick={() => setVoiceOn(!voiceOn)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            voiceOn ? 'bg-signal' : 'bg-line'
          }`}
          aria-label="Toggle Voice SOS"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
              voiceOn ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Live Status & Heard Text */}
      {voiceOn && (
        <div className="rounded-control bg-raised p-3 text-sm space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted">Status:</span>
            {error ? (
              <span className="font-bold text-signal">{error}</span>
            ) : listening ? (
              <span className="flex items-center gap-1.5 font-bold text-signal">
                <span className="h-2 w-2 rounded-full bg-signal" /> Listening for “help”
              </span>
            ) : state?.status === 'paused' ? (
              <span className="text-brass">Paused (app in background)</span>
            ) : (
              <span className="text-muted">Starting microphone…</span>
            )}
          </div>

          {listening && (
            <p className="text-xs text-ink/80 truncate">
              <span className="font-semibold text-muted">Hearing: </span>
              {heard ? (
                <span className="italic font-mono text-ink">“{heard}”</span>
              ) : (
                <span className="italic text-muted font-normal">(speak to test words)</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Test my voice button and result */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleTestVoice}
          disabled={testing}
          className="flex h-10 items-center justify-center gap-2 rounded-control border border-line bg-raised px-4 text-sm font-bold hover:bg-raised/80 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-brass" />
          {testing ? 'Listening… Say “help” now' : 'Test my voice (no alert sent)'}
        </button>

        {testing && (
          <p className="text-center text-xs text-muted animate-pulse">
            Microphone is active for test. Say <span className="font-bold text-signal">“help”</span> or <span className="font-bold text-signal">“bachao”</span> now.
          </p>
        )}

        {testResult && (
          <div className="flex items-start gap-2 rounded-control bg-neem/10 p-3 text-xs text-neem font-medium">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neem" />
            <div>
              <p className="font-bold">Detected “{testResult.word}”!</p>
              <p className="text-ink/80 mt-0.5">
                Voice SOS works properly with your voice. (No alert was sent).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Options */}
      <div className="border-t border-line pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soundBeeps}
            onChange={(e) => setSoundBeeps(e.target.checked)}
            className="rounded text-signal focus:ring-signal"
          />
          <Volume2 className="h-3.5 w-3.5 text-muted" />
          <span>Countdown audio beeps</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={keepAwake}
            onChange={(e) => setKeepAwake(e.target.checked)}
            className="rounded text-signal focus:ring-signal"
          />
          <Zap className="h-3.5 w-3.5 text-brass" />
          <span>Keep screen awake</span>
        </label>
      </div>

      {/* Diagnostics Toggle */}
      <div className="border-t border-line pt-2">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex w-full items-center justify-between text-xs font-semibold text-muted hover:text-ink py-1"
        >
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> Engine diagnostics
          </span>
          {showDiagnostics ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showDiagnostics && (
          <div className="mt-2 rounded-control bg-raised p-3 text-xs space-y-1 font-mono text-muted">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-ink">{state?.status || 'off'}</span>
            </div>
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="text-ink">{state?.mode || 'trigger'}</span>
            </div>
            <div className="flex justify-between">
              <span>Restarts:</span>
              <span className="text-ink">{restarts || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Screen WakeLock:</span>
              <span className={wakeLock ? 'text-neem' : 'text-muted'}>
                {wakeLock ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Language:</span>
              <span className="text-ink">{state?.lang || 'en-IN'}</span>
            </div>
            {lastMatch && (
              <div className="pt-1 border-t border-line/50">
                <span className="block font-sans font-semibold text-ink">Last Match:</span>
                <span className="block truncate text-ink">
                  Word: {lastMatch.word} | Mode: {lastMatch.mode}
                </span>
                <span className="block truncate text-muted text-[10px]">
                  Transcript: “{lastMatch.transcript}”
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
