/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        raised: c('raised'),
        ink: c('ink'),
        muted: c('muted'),
        line: c('line'),
        signal: c('signal'),
        neem: c('neem'),
        brass: c('brass'),
        glacial: c('glacial'),
        maroon: c('maroon'),
        night: c('night'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', '"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        panel: '1rem',
        control: '0.625rem',
        tag: '0.375rem',
      },
      boxShadow: {
        float: '0 20px 48px -16px rgb(var(--night) / 0.5), 0 0 0 1px rgb(var(--line) / 0.5)',
        sos: '0 16px 44px -8px rgb(var(--signal) / 0.65), 0 0 0 4px rgb(var(--signal) / 0.25)',
        glow: '0 0 24px -4px rgb(var(--glacial) / 0.4)',
        tactile: '0 2px 0 0 rgb(var(--line)), 0 6px 16px -4px rgb(var(--night) / 0.15)',
      },
      keyframes: {
        ring: {
          '0%': { transform: 'scale(0.88)', opacity: '0.6' },
          '100%': { transform: 'scale(1.75)', opacity: '0' },
        },
        rise: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        ring: 'ring 2.6s cubic-bezier(0.2, 0.6, 0.3, 1) infinite',
        rise: 'rise 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
