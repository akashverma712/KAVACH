import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  HeartPulse,
  MapPin,
  Phone,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Signal,
  X,
} from 'lucide-react';
import { Beacon } from '../components/Beacon';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { usePwaInstall } from '../hooks/usePwaInstall';

// High-fidelity web audio feedback synthesizer for authentic physical hardware feel
function playHapticChime(type = 'ping') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'ping') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'cancel') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'dispatch') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Non-blocking if audio policy restricts autoplay
  }
}

const HELPLINES = [
  {
    n: '112',
    name: 'National Emergency Service',
    dept: 'Police · Fire · Medical Dispatch',
    sla: 'Immediate 24×7 Rapid',
    tel: '112',
  },
  {
    n: '1091',
    name: 'Women Safety Cell',
    dept: 'Rapid Response & Confidential Counsel',
    sla: 'Toll-Free 24×7',
    tel: '1091',
  },
  {
    n: '108',
    name: 'Medical Trauma Transit',
    dept: 'Emergency Ambulance & Critical Care',
    sla: 'Direct Medical Transit',
    tel: '108',
  },
  {
    n: '14416',
    name: 'Tele-MANAS Mental Health',
    dept: 'Government Verified Student Counselling',
    sla: 'Confidential Helpline',
    tel: '14416',
  },
  {
    n: '0326-2350111',
    name: 'Campus Security Main Desk',
    dept: 'BIT Sindri Quick Response Patrol',
    sla: 'Campus Gate 1 Dispatch',
    tel: '03262350111',
  },
];

export default function Landing() {
  const { canInstall, install } = usePwaInstall();

  // Instant-Use SOS Console State
  const [abortCountdown, setAbortCountdown] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState('idle'); // 'idle' | 'counting' | 'dispatched' | 'aborted'
  const [coords, setCoords] = useState('23.6524° N, 86.4897° E');

  // Query live GPS coordinates quietly in the background
  useEffect(() => {
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(4);
          const lon = pos.coords.longitude.toFixed(4);
          setCoords(`${lat}° N, ${lon}° E`);
        },
        () => {
          setCoords('23.6524° N, 86.4897° E · Sindri');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // 10-second Abort Safety Window Timer
  useEffect(() => {
    if (abortCountdown === null || abortCountdown <= 0) return undefined;
    const timer = setTimeout(() => {
      if (abortCountdown === 1) {
        setAbortCountdown(0);
        setDispatchStatus('dispatched');
        playHapticChime('dispatch');
      } else {
        setAbortCountdown((c) => c - 1);
        playHapticChime('ping');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [abortCountdown]);

  const handleArmBeacon = () => {
    playHapticChime('ping');
    setDispatchStatus('counting');
    setAbortCountdown(10);
  };

  const handleAbort = () => {
    playHapticChime('cancel');
    setAbortCountdown(null);
    setDispatchStatus('aborted');
    setTimeout(() => setDispatchStatus('idle'), 2400);
  };

  const handleInstantDispatch = () => {
    playHapticChime('dispatch');
    setAbortCountdown(0);
    setDispatchStatus('dispatched');
  };

  const handleResetConsole = () => {
    setAbortCountdown(null);
    setDispatchStatus('idle');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] antialiased selection:bg-[#FF3B30]/20 selection:text-[#FF3B30] overflow-x-hidden">
      {/* ───────────────── FLOATING APPLE GLASS NAVBAR ───────────────── */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-4 inset-x-0 z-50 mx-auto max-w-5xl px-4 pointer-events-none"
      >
        <div className="pointer-events-auto flex items-center justify-between rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#121214]/85 backdrop-blur-2xl px-4 py-2.5 sm:px-6 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)]">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo compact />
            <span className="flex flex-col">
              <strong className="font-display text-[15px] font-bold tracking-tight text-[#1D1D1F] dark:text-white leading-none">
                Kavach
              </strong>
              <small className="text-[10px] font-medium tracking-wider text-[#86868B] dark:text-[#A1A1A6] uppercase mt-0.5">
                BIT Sindri
              </small>
            </span>
          </Link>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1 text-[13px] font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            <a
              href="#overview"
              className="rounded-full px-3.5 py-1.5 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              Overview
            </a>
            <a
              href="#technology"
              className="rounded-full px-3.5 py-1.5 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              Technology
            </a>
            <a
              href="#ecosystem"
              className="rounded-full px-3.5 py-1.5 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              Ecosystem
            </a>
            <a
              href="#helplines"
              className="rounded-full px-3.5 py-1.5 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              Helplines
            </a>
          </nav>

          {/* Right Action Group */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="hidden sm:inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold text-[#515154] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/register"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#000000] dark:bg-[#FFFFFF] px-4.5 text-xs font-semibold text-white dark:text-[#000000] shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                <span>Launch App</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <main className="pt-24 sm:pt-28">
        {/* ───────────────── 1. HERO: CLEAN EDITORIAL + INSTANT-USE SOS CONSOLE ───────────────── */}
        <section id="overview" className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-20 sm:pb-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 min-h-[calc(100dvh-11rem)]">
            {/* Left Column: Pure Confident Headline (No Eyebrow, No Neon) */}
            <article className="flex flex-col items-start text-left">
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="font-display text-4xl sm:text-6xl lg:text-[4.25rem] font-bold leading-[1.05] tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]"
              >
                Emergency response. <br />
                <span className="text-[#FF3B30]">Engineered for campus.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-6 max-w-xl text-base sm:text-lg text-[#515154] dark:text-[#A1A1A6] font-normal leading-relaxed"
              >
                Instant dual-band GPS dispatch, zero-data SMS mesh fallback, and a cryptographically sealed civic ledger. Built exclusively to keep 4,000+ students safe across BIT Sindri.
              </motion.p>

              {/* Action Nav Links */}
              <motion.nav
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-8 flex flex-wrap items-center gap-3.5"
                aria-label="Student Onboarding Actions"
              >
                <Link
                  to="/register"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[#FF3B30] px-7 text-xs font-semibold tracking-wide text-white shadow-[0_10px_28px_-6px_rgba(255,59,48,0.45)] hover:bg-[#E02020] active:scale-95 transition-all"
                >
                  <span>Create Student Account</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center rounded-full border border-black/[0.1] dark:border-white/[0.15] bg-white dark:bg-[#18181B] px-6 text-xs font-semibold tracking-wide text-[#1D1D1F] dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.05] active:scale-95 transition-all"
                >
                  Sign In
                </Link>
                {canInstall && (
                  <button
                    type="button"
                    onClick={install}
                    className="inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                  >
                    <Download className="h-4 w-4" /> Install App
                  </button>
                )}
              </motion.nav>

              {/* Specs Definition List */}
              <motion.dl
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-10 grid grid-cols-3 gap-6 border-t border-black/[0.06] dark:border-white/[0.08] pt-6 text-left w-full max-w-lg"
              >
                <div>
                  <dt className="font-display text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                    0.8s
                  </dt>
                  <dd className="mt-0.5 text-xs text-[#86868B] dark:text-[#8E8E93]">
                    WebSocket Dispatch
                  </dd>
                </div>
                <div>
                  <dt className="font-display text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                    0 Data
                  </dt>
                  <dd className="mt-0.5 text-xs text-[#86868B] dark:text-[#8E8E93]">
                    SMS Mesh Fallback
                  </dd>
                </div>
                <div>
                  <dt className="font-display text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                    10s
                  </dt>
                  <dd className="mt-0.5 text-xs text-[#86868B] dark:text-[#8E8E93]">
                    Acoustic Abort Safety
                  </dd>
                </div>
              </motion.dl>
            </article>

            {/* Right Column: INSTANT-USE PROFESSIONAL SOS CONSOLE (Zero Unwanted Fluff) */}
            <motion.article
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-[2.5rem] border border-black/[0.08] dark:border-white/[0.12] bg-[#FFFFFF] dark:bg-[#0A0A0C] p-6 sm:p-8 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] transition-all w-full max-w-md mx-auto lg:max-w-none"
            >
              {/* Mission-Critical Telemetry Status Bar */}
              <header className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
                <span className="flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-[#1D1D1F] dark:text-white uppercase">
                  <span className="h-2 w-2 rounded-full bg-[#30D158] animate-pulse" />
                  EMERGENCY SOS BEACON
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#86868B] dark:text-[#8E8E93]">
                  <MapPin className="h-3.5 w-3.5 text-[#30D158]" />
                  <span>{coords}</span>
                </span>
              </header>

              {/* Direct Instant Action Console Body */}
              <div className="mt-6 flex flex-col items-center justify-center min-h-[290px]">
                <AnimatePresence mode="wait">
                  {/* STATE 1: ARMED & READY TO TRIGGER INSTANTLY */}
                  {dispatchStatus === 'idle' && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center text-center w-full"
                    >
                      <Beacon size={195} onPress={handleArmBeacon} label="SOS" sub="Tap to Trigger" />
                      <p className="mt-5 text-xs text-[#86868B] dark:text-[#8E8E93] max-w-xs leading-relaxed">
                        Tap for instant alert. Initiates a 10-second audible cancellation window before broadcasting GPS to security & contacts.
                      </p>
                    </motion.div>
                  )}

                  {/* STATE 2: 10-SECOND SAFETY COUNTDOWN (ACTIVE DISPATCH CYCLE) */}
                  {dispatchStatus === 'counting' && (
                    <motion.div
                      key="counting"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center w-full"
                    >
                      <div className="relative flex h-48 w-48 items-center justify-center">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r="44"
                            className="stroke-black/10 dark:stroke-white/10"
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="44"
                            className="stroke-[#FF3B30] transition-all duration-1000 ease-linear"
                            strokeWidth="6"
                            strokeDasharray="276"
                            strokeDashoffset={276 * (1 - (abortCountdown || 0) / 10)}
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-display text-6xl font-bold tracking-tight text-[#FF3B30]">
                            {abortCountdown}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                            Seconds to Abort
                          </span>
                        </div>
                      </div>

                      <p className="mt-4 text-xs font-medium text-[#1D1D1F] dark:text-white">
                        Live coordinates locked: {coords}
                      </p>

                      <div className="mt-4 flex w-full max-w-xs gap-2">
                        <button
                          type="button"
                          onClick={handleAbort}
                          className="flex-1 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 py-2.5 text-xs font-semibold text-[#1D1D1F] dark:text-white transition-all active:scale-95"
                        >
                          Cancel (I'm Safe)
                        </button>
                        <button
                          type="button"
                          onClick={handleInstantDispatch}
                          className="rounded-full bg-[#FF3B30] hover:bg-[#E02020] px-4 py-2.5 text-xs font-semibold text-white transition-all active:scale-95"
                        >
                          Dispatch Now
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* STATE 3: CONFIRMED DISPATCH WITH DIRECT ACTION PHONE SHORTCUTS */}
                  {dispatchStatus === 'dispatched' && (
                    <motion.div
                      key="dispatched"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] p-5 w-full text-center"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#30D158]/15 text-[#30D158]">
                        <CheckCircle2 className="h-6 w-6" />
                      </span>
                      <h3 className="mt-3 font-display text-base font-bold text-[#1D1D1F] dark:text-white">
                        SOS Dispatched to Campus Desk
                      </h3>
                      <dl className="mt-3 w-full rounded-xl bg-white dark:bg-[#18181B] border border-black/[0.06] dark:border-white/[0.08] p-3 text-left font-mono text-[11px] space-y-1 text-[#515154] dark:text-[#A1A1A6]">
                        <dt className="text-[#30D158] font-semibold">● Real-time GPS: {coords}</dt>
                        <dd>Target: BIT Sindri Security Patrol Desk</dd>
                        <dd>SMS Mesh Fallback: Armed & Active</dd>
                      </dl>
                      <button
                        type="button"
                        onClick={handleResetConsole}
                        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] hover:underline"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset Emergency Beacon
                      </button>
                    </motion.div>
                  )}

                  {/* STATE 4: ABORTED FALSE ALARM */}
                  {dispatchStatus === 'aborted' && (
                    <motion.div
                      key="aborted"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center py-6 text-center"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-[#86868B]">
                        <X className="h-6 w-6" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-[#1D1D1F] dark:text-white">
                        Alert Aborted Safely
                      </p>
                      <p className="mt-1 text-xs text-[#86868B]">
                        Zero false alarms sent. Standby armed.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Direct Fast-Dial Hotlines: In-Console Emergency Shortcuts */}
              <div className="mt-5 grid grid-cols-2 gap-2 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                <a
                  href="tel:03262350111"
                  className="flex items-center justify-center gap-2 rounded-xl bg-black/5 dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/[0.1] py-2.5 px-3 text-xs font-semibold text-[#1D1D1F] dark:text-white transition-all"
                >
                  <Phone className="h-3.5 w-3.5 text-[#30D158]" />
                  <span>Call Security Desk</span>
                </a>
                <a
                  href="tel:112"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#FF3B30]/10 hover:bg-[#FF3B30]/15 py-2.5 px-3 text-xs font-semibold text-[#FF3B30] transition-all"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>National 112</span>
                </a>
              </div>

              {/* Direct Status Footer */}
              <footer className="mt-4 flex items-center justify-between text-[11px] text-[#86868B] dark:text-[#8E8E93]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#30D158]" /> 24/7 Sindri Dispatch
                </span>
                <span>Zero Internet Data Required</span>
              </footer>
            </motion.article>
          </div>
        </section>

        {/* ───────────────── 2. CHAPTER 1: SATELLITE & GSM MESH (SEMANTIC ORDERED LIST) ───────────────── */}
        <section id="technology" className="border-t border-black/[0.06] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#0A0A0C] py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <article>
                <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#1D1D1F] dark:text-white leading-[1.1]">
                  Zero mobile data. <br />
                  <span className="text-[#0071E3]">Still dispatched.</span>
                </h2>
                <p className="mt-6 text-base sm:text-lg text-[#515154] dark:text-[#A1A1A6] font-normal leading-relaxed">
                  Basement engineering workshops, underground hostel corridors, and remote campus corners frequently suffer cellular blackspots. Traditional safety apps spin indefinitely on missing internet.
                </p>
                <p className="mt-4 text-base sm:text-lg text-[#515154] dark:text-[#A1A1A6] font-normal leading-relaxed">
                  Kavach doesn't fail silently. When Wi-Fi or 4G/5G packets drop, our protocol autonomously condenses your identity and dual-frequency GPS coordinates into raw encrypted GSM SMS bursts directly to campus security dispatch and designated personal emergency contacts.
                </p>

                <ul className="mt-8 flex flex-col gap-3 text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-[#30D158] shrink-0" />
                    <span>Dual-carrier failover across Jio, Airtel, and BSNL networks</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-[#30D158] shrink-0" />
                    <span>Google Maps hyperlinked coordinates embedded in raw SMS payload</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-[#30D158] shrink-0" />
                    <span>Works on low-power battery reserve below 5%</span>
                  </li>
                </ul>
              </article>

              {/* Semantic Ordered List */}
              <ol className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#121214] p-6 sm:p-8 space-y-4 shadow-sm">
                <li className="flex items-start justify-between rounded-2xl bg-white dark:bg-[#1C1C1E] p-4.5 border border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <span className="text-xs font-semibold text-[#86868B] uppercase">Layer 01</span>
                    <h4 className="font-display text-base font-bold text-[#1D1D1F] dark:text-white mt-0.5">
                      Primary WebSocket Pipeline
                    </h4>
                    <p className="text-xs text-[#515154] dark:text-[#A1A1A6] mt-1">
                      Encrypted binary stream to BIT Sindri security dispatch desk (avg. 24ms round-trip).
                    </p>
                  </div>
                  <span className="rounded-full bg-[#30D158]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#30D158]">
                    NORMAL
                  </span>
                </li>

                <li className="flex items-start justify-between rounded-2xl bg-white dark:bg-[#1C1C1E] p-4.5 border border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <span className="text-xs font-semibold text-[#86868B] uppercase">Layer 02</span>
                    <h4 className="font-display text-base font-bold text-[#1D1D1F] dark:text-white mt-0.5">
                      Autonomous Cellular GSM SMS
                    </h4>
                    <p className="text-xs text-[#515154] dark:text-[#A1A1A6] mt-1">
                      Triggered instantaneously when HTTP/WebSocket handshakes timeout after 800ms.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#0071E3]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#0071E3]">
                    FAILSAFE
                  </span>
                </li>

                <li className="flex items-start justify-between rounded-2xl bg-white dark:bg-[#1C1C1E] p-4.5 border border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <span className="text-xs font-semibold text-[#86868B] uppercase">Layer 03</span>
                    <h4 className="font-display text-base font-bold text-[#1D1D1F] dark:text-white mt-0.5">
                      Local Peer Acoustic Beacon
                    </h4>
                    <p className="text-xs text-[#515154] dark:text-[#A1A1A6] mt-1">
                      Piezo siren pulse (85dB peak) alerts immediate nearby students and hostel wardens.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FF9500]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#FF9500]">
                    ACOUSTIC
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* ───────────────── 3. CHAPTER 2: TAMPER-EVIDENT CIVIC ACCOUNTABILITY (SEMANTIC RECEIPT) ───────────────── */}
        <section className="border-t border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#000000] py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              {/* Graphic Receipt: Article with Semantic DL */}
              <article className="order-2 lg:order-1 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#0A0A0C] p-6 sm:p-8 shadow-sm">
                <header className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
                  <span className="font-mono text-xs font-bold text-[#86868B] uppercase">
                    Tamper-Evident SHA-256 Ledger
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#30D158]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Cryptographically Sealed
                  </span>
                </header>

                <dl className="mt-5 space-y-3 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <dt className="text-[#86868B]">Dispatch ID</dt>
                    <dd className="font-bold text-[#1D1D1F] dark:text-white">#KV-BIT-8921-SND</dd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <dt className="text-[#86868B]">GPS Coordinate</dt>
                    <dd className="font-bold text-[#1D1D1F] dark:text-white">23.6524° N, 86.4897° E</dd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <dt className="text-[#86868B]">Admin Log Time</dt>
                    <dd className="font-bold text-[#1D1D1F] dark:text-white">22:14:08 IST (Locked)</dd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <dt className="text-[#86868B]">Security Response</dt>
                    <dd className="font-bold text-[#30D158]">Officer Acknowledged (0.9s)</dd>
                  </div>
                </dl>
                <footer className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04] text-[10px] font-mono text-[#86868B] break-all leading-tight">
                  SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
                </footer>
              </article>

              {/* Story */}
              <article className="order-1 lg:order-2">
                <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#1D1D1F] dark:text-white leading-[1.1]">
                  Every dispatch. <br />
                  <span className="text-[#FF9500]">Cryptographically verified.</span>
                </h2>
                <p className="mt-6 text-base sm:text-lg text-[#515154] dark:text-[#A1A1A6] font-normal leading-relaxed">
                  Safety fails on campuses when administration quietly sweeps incident reports under the rug. Kavach fixes the accountability deficit at the architectural layer.
                </p>
                <p className="mt-4 text-base sm:text-lg text-[#515154] dark:text-[#A1A1A6] font-normal leading-relaxed">
                  Every SOS trigger and maintenance report creates an immutable SHA-256 timestamped proof receipt on an audit trail visible to students and welfare committees. No security desk can claim an alert was never received.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ───────────────── 4. CAMPUS ECOSYSTEM: SEMANTIC BENTO ARTICLES ───────────────── */}
        <section id="ecosystem" className="border-t border-black/[0.06] dark:border-white/[0.08] bg-[#FFFFFF] dark:bg-[#0A0A0C] py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="max-w-2xl">
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                More than an SOS button.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
                Emergency response integrated with civic problem tracking, verified student mutual aid, and confidential healthcare.
              </p>
            </header>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {/* Tile 1: Community Civic Ledger */}
              <article className="md:col-span-2 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#121214] p-8 flex flex-col justify-between">
                <div>
                  <header className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#86868B] uppercase">
                      Civic Infrastructure
                    </span>
                    <span className="rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-xs font-semibold text-[#1D1D1F] dark:text-white">
                      Live Resolution Feed
                    </span>
                  </header>
                  <h3 className="mt-4 font-display text-2xl font-bold text-[#1D1D1F] dark:text-white">
                    Campus Hazard & Problem Ledger
                  </h3>
                  <p className="mt-3 text-sm sm:text-base text-[#515154] dark:text-[#A1A1A6] max-w-xl leading-relaxed">
                    Broken high-mast lighting near Hostel 7? Unsafe road stretches? Water disruptions? Post with geo-tagged photos and severity tiers. Fellow students upvote, and you track progress from Open to Resolved in real time.
                  </p>
                </div>

                <footer className="mt-8 flex flex-wrap items-center gap-2 pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
                  {['Reported', 'Acknowledged', 'Assigned', 'In Progress', 'Resolved'].map((st, i, arr) => (
                    <span key={st} className="flex items-center gap-2 text-xs font-semibold">
                      <span
                        className={`rounded-full px-3 py-1 ${
                          i === arr.length - 1
                            ? 'bg-[#30D158]/15 text-[#30D158]'
                            : i === 2
                            ? 'bg-[#0071E3]/15 text-[#0071E3]'
                            : 'bg-black/5 dark:bg-white/5 text-[#86868B]'
                        }`}
                      >
                        {st}
                      </span>
                      {i < arr.length - 1 && <span className="h-px w-2 bg-black/20 dark:bg-white/20" />}
                    </span>
                  ))}
                </footer>
              </article>

              {/* Tile 2: Zero-Commission Mutual Aid */}
              <article className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#121214] p-8 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#86868B] uppercase">
                    Student Welfare
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-bold text-[#1D1D1F] dark:text-white">
                    Verified Mutual Aid
                  </h3>
                  <p className="mt-3 text-sm text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
                    In emergency medical situations, students can raise verified funds. Admin authenticates hospital bills before going live. 100% of donations go directly to student UPI.
                  </p>
                </div>
                <footer className="mt-8 pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-[#30D158] rounded-full w-3/4" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#86868B]">
                    Zero platform fees · 100% to student
                  </p>
                </footer>
              </article>

              {/* Tile 3: Confidential Wellbeing Pulse */}
              <article className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#121214] p-8 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#86868B] uppercase">
                    Mental Health
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-bold text-[#1D1D1F] dark:text-white">
                    Daily Wellbeing Pulse
                  </h3>
                  <p className="mt-3 text-sm text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
                    Track emotional wellbeing in total privacy on your device. Zero data sent to servers. Free 24/7 mental health counselling hotlines (Tele-MANAS) are one tap away.
                  </p>
                </div>
                <footer className="mt-8 flex items-center justify-between pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <span className="text-xs font-semibold text-[#30D158]">Tele-MANAS 14416 Linked</span>
                  <HeartPulse className="h-5 w-5 text-[#FF3B30]" />
                </footer>
              </article>

              {/* Tile 4: Campus Knowledge Assistant */}
              <article className="md:col-span-2 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#121214] p-8 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#86868B] uppercase">
                    Campus Navigation
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-bold text-[#1D1D1F] dark:text-white">
                    Verified Campus Safety Assistant
                  </h3>
                  <p className="mt-3 text-sm sm:text-base text-[#515154] dark:text-[#A1A1A6] max-w-xl leading-relaxed">
                    Instant verified guidance on hostel gate timings, dispensary doctor schedules, security outpost locations, and emergency protocols maintained directly by BIT Sindri administration.
                  </p>
                </div>
                <footer className="mt-8 flex flex-wrap gap-2 pt-6 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <span className="rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] px-3 py-1 text-xs font-medium text-[#1D1D1F] dark:text-white">
                    “Hostel gate curfews tonight?”
                  </span>
                  <span className="rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] px-3 py-1 text-xs font-medium text-[#1D1D1F] dark:text-white">
                    “Dispensary emergency contact?”
                  </span>
                  <span className="rounded-full bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] px-3 py-1 text-xs font-medium text-[#1D1D1F] dark:text-white">
                    “Security Gate 1 phone number?”
                  </span>
                </footer>
              </article>
            </div>
          </div>
        </section>

        {/* ───────────────── 5. DIRECT EMERGENCY HELPLINES DIRECTORY ───────────────── */}
        <section id="helplines" className="bg-[#000000] text-white py-24 sm:py-32 border-t border-white/[0.08]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white">
                  Direct Emergency Helplines
                </h2>
                <p className="mt-3 text-sm sm:text-base text-[#86868B] max-w-xl">
                  Carrier-level phone dialing that connects reliably without cellular data, active Wi-Fi, or internet balance.
                </p>
              </div>
            </header>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {HELPLINES.map((h) => (
                <a
                  key={h.n}
                  href={`tel:${h.tel}`}
                  className="group flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7 transition-all hover:bg-white/[0.06] hover:border-white/[0.2]"
                >
                  <header className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-bold tracking-tight text-white group-hover:text-[#0071E3] transition-colors">
                      {h.n}
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF9500]">
                      {h.sla}
                    </span>
                  </header>
                  <div className="mt-8">
                    <h4 className="text-sm font-bold text-white">{h.name}</h4>
                    <p className="text-xs text-[#86868B] mt-1">{h.dept}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 group-hover:text-white">
                      <Phone className="h-3.5 w-3.5 text-[#30D158]" /> Tap to Call Now →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────────── 6. CLOSING EDITORIAL CTA ───────────────── */}
        <section className="bg-[#F5F5F7] dark:bg-[#000000] py-24 sm:py-32 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
              Safety on campus, from day one.
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-base sm:text-lg text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
              Activation takes under 60 seconds with your verified college credentials.
            </p>

            <nav
              className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
              aria-label="Call to action actions"
            >
              <Link
                to="/register"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#FF3B30] px-8 text-xs font-semibold tracking-wide text-white shadow-[0_10px_28px_-6px_rgba(255,59,48,0.45)] hover:bg-[#E02020] active:scale-95 transition-all"
              >
                <span>Activate Student Account</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-12 items-center rounded-full border border-black/[0.1] dark:border-white/[0.15] bg-white dark:bg-[#18181B] px-7 text-xs font-semibold tracking-wide text-[#1D1D1F] dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.05] active:scale-95 transition-all"
              >
                Student Sign In
              </Link>
            </nav>
          </div>
        </section>
      </main>

      {/* ───────────────── 7. MINIMALIST FOOTER & STATUS INDICATOR ───────────────── */}
      <footer className="border-t border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#000000] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 text-xs text-[#86868B] dark:text-[#8E8E93] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Kavach Student Safety Infrastructure · Birsa Institute of Technology (BIT) Sindri, Dhanbad, Jharkhand 828123
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium text-[#1D1D1F] dark:text-white">
              <span className="h-2 w-2 rounded-full bg-[#30D158]" /> All Systems Operational
            </span>
            <span className="text-black/20 dark:text-white/20">|</span>
            <a href="tel:112" className="font-semibold text-[#FF3B30] hover:underline">
              Emergency? Dial 112
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
