import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Download, HandCoins, HeartPulse, MapPin, Mic, Phone, ShieldCheck, Users } from 'lucide-react';
import { Beacon } from '../components/Beacon';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { usePwaInstall } from '../hooks/usePwaInstall';

const HELPLINES = [
  { n: '112', label: 'Emergency (police, fire, ambulance)' },
  { n: '108', label: 'Ambulance' },
  { n: '1091', label: 'Women helpline' },
  { n: '14416', label: 'Tele-MANAS mental health, 24×7' },
];

function BeaconDemo() {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (left === null || left <= 0) return undefined;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const label = left === null ? 'SOS' : left > 0 ? String(left) : 'Sent';
  const sub = left === null ? 'Tap to try' : left > 0 ? 'Demo countdown' : 'Demo only';

  return (
    <div className="flex flex-col items-center">
      <Beacon size={200} label={label} sub={sub} onPress={() => setLeft((l) => (l === null || l <= 0 ? 10 : l))} ariaLabel="Try the SOS button. This is a demo and nothing is sent." />
      <div className="mt-2 h-12 text-center" aria-live="polite">
        {left !== null && left > 0 && (
          <button type="button" onClick={() => setLeft(null)} className="h-11 rounded-control border border-line bg-surface px-5 font-bold hover:border-ink/40">Cancel</button>
        )}
        {left === 0 && <p className="max-w-xs text-sm text-muted">In the app, your contacts and the campus admin would now get an SMS with your live location. <button type="button" className="font-bold text-ink underline" onClick={() => setLeft(null)}>Reset</button></p>}
        {left === null && <p className="text-sm text-muted">This is a demo. Nothing is sent from this page.</p>}
      </div>
    </div>
  );
}

export default function Landing() {
  const { canInstall, install } = usePwaInstall();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
        <Logo />
        <div className="flex-1" />
        <ThemeToggle />
        <Link to="/login" className="inline-flex h-10 items-center rounded-control px-3 font-bold hover:bg-ink/5 dark:hover:bg-white/5">Sign in</Link>
        <Link to="/register" className="inline-flex h-10 items-center rounded-control bg-ink px-4 font-bold text-bg hover:bg-ink/90">Register</Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
          <div>
            <h1 className="max-w-[14ch] text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl">Help reaches you in one tap.</h1>
            <p className="mt-5 max-w-[52ch] text-lg text-muted">
              Kavach is the safety and wellbeing app for BIT Sindri students. Send your live location to the people you trust and the campus admin, raise problems the college can track to a fix, and support classmates who need help.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="inline-flex h-12 items-center rounded-control bg-signal px-6 text-base font-bold text-white hover:bg-signal/90">Create your account</Link>
              <Link to="/login" className="inline-flex h-12 items-center rounded-control border border-line bg-surface px-6 text-base font-bold hover:border-ink/40">Sign in</Link>
              {canInstall && (
                <button type="button" onClick={install} className="inline-flex h-12 items-center gap-2 rounded-control px-4 font-bold text-muted hover:text-ink"><Download className="h-5 w-5" /> Install app</button>
              )}
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted">
              <ShieldCheck className="h-4 w-4 text-neem" /> Only for students in college records or with an @bitsindri.ac.in email.
            </p>
          </div>
          <BeaconDemo />
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-3xl font-extrabold">What happens when you press SOS</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {[
                { icon: Mic, t: 'Tap the button, or say “help”', d: 'Voice trigger keeps listening while Kavach is open, for moments when you can’t reach the screen.' },
                { icon: ShieldCheck, t: 'You get 10 seconds to cancel', d: 'Pressed it by accident? Cancel during the countdown and nothing is sent.' },
                { icon: MapPin, t: 'Your location goes out by SMS', d: 'Every emergency contact and the campus admin gets a Google Maps link to where you are.' },
              ].map(({ icon: Icon, t, d }, i) => (
                <li key={t} className="relative pl-14">
                  <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-signal font-display text-lg font-extrabold text-signal">{i + 1}</span>
                  <h3 className="flex items-center gap-2 text-lg font-bold"><Icon className="h-5 w-5 text-muted" aria-hidden />{t}</h3>
                  <p className="mt-1.5 text-muted">{d}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-2xl text-sm text-muted">Up to 10 alerts can be sent in an hour. Without internet, Kavach opens your phone’s SMS app with the message ready and sends the alert again once you’re back online.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="max-w-xl text-3xl font-extrabold">The rest of campus life, in the same place</h2>
          <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            <div className="border-t-2 border-ink pt-5">
              <Users className="h-6 w-6" aria-hidden />
              <h3 className="mt-3 text-xl font-bold">Community problems</h3>
              <p className="mt-2 text-muted">Post broken streetlights, hostel water cuts or anything unsafe, with photos. Classmates react and discuss, and you can follow the admin’s progress to the end.</p>
              <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
                {['Open', 'Marked for solving', 'In progress', 'Under review', 'Solved'].map((s, i, a) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 ${i === a.length - 1 ? 'bg-neem/15 text-neem' : 'bg-raised text-muted'}`}>{s}</span>
                    {i < a.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
                  </span>
                ))}
              </div>
            </div>
            <div className="border-t-2 border-ink pt-5">
              <HandCoins className="h-6 w-6" aria-hidden />
              <h3 className="mt-3 text-xl font-bold">Fundraisers you can trust</h3>
              <p className="mt-2 text-muted">After an accident or medical emergency, a student can share payment QR codes and the amount needed. The admin checks the proof before anything goes live.</p>
            </div>
            <div className="border-t-2 border-ink pt-5">
              <Bot className="h-6 w-6" aria-hidden />
              <h3 className="mt-3 text-xl font-bold">Ask about the college</h3>
              <p className="mt-2 text-muted">A campus assistant answers questions about BIT Sindri, using Kavach and where to find support, from answers maintained by the admin.</p>
            </div>
            <div className="border-t-2 border-ink pt-5">
              <HeartPulse className="h-6 w-6" aria-hidden />
              <h3 className="mt-3 text-xl font-bold">Looking after yourself</h3>
              <p className="mt-2 text-muted">A private daily check-in, stored only on your phone, with free counselling numbers one tap away when a day feels heavy.</p>
            </div>
          </div>
        </section>

        <section className="bg-night text-white dark:bg-raised">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="text-2xl font-extrabold">Helplines that work without the app</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {HELPLINES.map((h) => (
                <li key={h.n}>
                  <a href={`tel:${h.n}`} className="flex items-center gap-4 rounded-panel border border-white/15 px-4 py-4 hover:bg-white/5">
                    <Phone className="h-5 w-5 shrink-0 text-white/70" aria-hidden />
                    <span><span className="block font-display text-2xl font-extrabold">{h.n}</span><span className="text-sm text-white/75">{h.label}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Kavach, campus safety for BIT Sindri, Dhanbad</p>
        <p>In immediate danger? Call <a href="tel:112" className="font-bold text-ink">112</a>.</p>
      </footer>
    </div>
  );
}
