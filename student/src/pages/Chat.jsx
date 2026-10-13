import { useEffect, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, Sparkles, Phone, Siren } from 'lucide-react';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const KEY = 'kavach-chat';
const SOURCE_NOTE = {
  knowledge_base: 'Verified campus knowledge base',
  ai: 'AI synthesized from college handbook',
  safety: 'Official safety protocol',
  fallback: null,
  smalltalk: null,
};

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [starters, setStarters] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api('/chat/suggestions')
      .then((d) => setStarters(d.suggestions))
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(messages.slice(-40)));
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: q, at: Date.now() }]);
    setBusy(true);
    try {
      const r = await api('/chat', { method: 'POST', body: { message: q, history } });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: r.answer,
          source: r.source,
          suggestions: r.suggestions,
          at: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            err.status === 0
              ? 'You are currently offline. Connect to internet to consult the assistant. For immediate emergency, use the SOS Beacon or call 112.'
              : err.message,
          error: true,
          at: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const last = messages[messages.length - 1];

  return (
    <div className="mx-auto flex h-[calc(100dvh-13rem)] max-w-3xl flex-col lg:h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-glacial">
            CAMPUS INTELLIGENCE
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-ink">
            Ask Kavach Assistant
          </h1>
          <p className="text-xs text-muted">
            Instant guidance regarding BIT Sindri campus navigation, emergency protocols & rules.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear History
          </Button>
        )}
      </div>

      {/* Chat Conversation Container */}
      <div className="panel mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center p-6">
              <span className="flex h-14 w-14 items-center justify-center rounded-control bg-glacial/15 text-glacial border border-glacial/30">
                <Bot className="h-7 w-7" />
              </span>
              <p className="mt-4 font-display text-lg font-black text-ink">
                Hello {user?.name?.split(' ')[0]}, how can I assist you today?
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted">
                Choose a common prompt below or type your campus inquiry:
              </p>
              <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-control border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink shadow-sm hover:border-glacial hover:bg-raised transition-all active:scale-95"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={`${m.at}-${i}`}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-rise`}
            >
              <div
                className={`max-w-[85%] rounded-panel px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-none bg-ink text-bg font-medium shadow-sm'
                    : m.error
                    ? 'rounded-bl-none border border-signal/40 bg-signal/10 text-signal font-medium'
                    : 'rounded-bl-none border border-line bg-raised/80 text-ink'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === 'assistant' && SOURCE_NOTE[m.source] && (
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-muted/80">
                    Source: {SOURCE_NOTE[m.source]}
                  </p>
                )}
                {m.source === 'safety' && (
                  <div className="mt-3.5 flex flex-wrap gap-2 pt-2 border-t border-line/60">
                    <a
                      href="tel:14416"
                      className="inline-flex items-center gap-1.5 rounded-control bg-neem px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white dark:text-night shadow-sm"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call 14416 (Tele-MANAS)
                    </a>
                    <a
                      href="tel:112"
                      className="inline-flex items-center gap-1.5 rounded-control bg-signal px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-sm"
                    >
                      <Siren className="h-3.5 w-3.5" /> Call 112 (Emergency)
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start animate-rise">
              <div
                className="flex items-center gap-1.5 rounded-panel rounded-bl-none border border-line bg-raised px-4 py-3"
                aria-label="Assistant is thinking"
              >
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 animate-bounce rounded-full bg-glacial"
                    style={{ animationDelay: `${d * 0.18}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {!busy && last?.role === 'assistant' && last.suggestions?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {last.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted hover:text-ink hover:border-glacial transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2 border-t border-line bg-surface p-3"
        >
          <label htmlFor="chat-input" className="sr-only">
            Ask a question
          </label>
          <input
            ref={inputRef}
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Ask about hostel rules, security posts, exams, or SOS…"
            className="field-input flex-1"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 bg-ink text-bg hover:bg-ink/90"
            disabled={!input.trim() || busy}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
