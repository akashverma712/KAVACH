import { useEffect, useRef, useState } from 'react';
import { Bot, RotateCcw, Send } from 'lucide-react';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const KEY = 'kavach-chat';
const SOURCE_NOTE = { knowledge_base: 'From the campus knowledge base', ai: 'AI answer using the campus knowledge base', safety: 'Safety resources', fallback: null, smalltalk: null };

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });
  const [starters, setStarters] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { api('/chat/suggestions').then((d) => setStarters(d.suggestions)).catch(() => {}); }, []);
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
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, source: r.source, suggestions: r.suggestions, at: Date.now() }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: err.status === 0 ? 'You’re offline. Connect to the internet to ask questions. For emergencies, use SOS or call 112.' : err.message, error: true, at: Date.now() }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const last = messages[messages.length - 1];

  return (
    <div className="mx-auto flex h-[calc(100dvh-13rem)] max-w-3xl flex-col lg:h-[calc(100dvh-7.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.9rem] font-extrabold">Ask Kavach</h1>
          <p className="text-muted">Questions about BIT Sindri, the app, or where to find support.</p>
        </div>
        {messages.length > 0 && <Button variant="ghost" size="sm" onClick={() => setMessages([])}><RotateCcw className="h-4 w-4" /> New chat</Button>}
      </div>

      <div className="panel mt-4 flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-raised"><Bot className="h-7 w-7" /></span>
              <p className="mt-3 text-lg font-bold">Hi {user?.name?.split(' ')[0]}, what would you like to know?</p>
              <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
                {starters.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line px-3.5 py-2 text-sm font-bold hover:border-ink/40">{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={`${m.at}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-panel px-4 py-3 ${m.role === 'user' ? 'rounded-br-md bg-ink text-bg' : m.error ? 'rounded-bl-md bg-signal/10 text-signal' : 'rounded-bl-md bg-raised'}`}>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
                {m.role === 'assistant' && SOURCE_NOTE[m.source] && <p className="mt-1.5 text-xs text-muted">{SOURCE_NOTE[m.source]}</p>}
                {m.source === 'safety' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href="tel:14416" className="rounded-control bg-neem px-3 py-1.5 text-sm font-bold text-white dark:text-night">Call 14416</a>
                    <a href="tel:112" className="rounded-control bg-signal px-3 py-1.5 text-sm font-bold text-white">Call 112</a>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start"><div className="flex gap-1 rounded-panel rounded-bl-md bg-raised px-4 py-4" aria-label="Assistant is typing">
              {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 0.15}s` }} />)}
            </div></div>
          )}
          {!busy && last?.role === 'assistant' && last.suggestions?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {last.suggestions.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink/40">{s}</button>)}
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="chat-input" className="sr-only">Ask a question</label>
          <input ref={inputRef} id="chat-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Ask about exams, hostels, SOS…" className="field-input flex-1" autoComplete="off" />
          <Button type="submit" size="icon" className="h-[46px] w-[46px]" disabled={!input.trim() || busy} aria-label="Send"><Send className="h-5 w-5" /></Button>
        </form>
      </div>
    </div>
  );
}
