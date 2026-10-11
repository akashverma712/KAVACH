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
        night: c('night'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', '"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { panel: '1.25rem', control: '0.75rem' },
      boxShadow: {
        float: '0 18px 40px -18px rgb(var(--night) / 0.45)',
        sos: '0 20px 50px -12px rgb(var(--signal) / 0.55)',
      },
      keyframes: {
        ring: { '0%': { transform: 'scale(0.85)', opacity: '0.55' }, '100%': { transform: 'scale(1.7)', opacity: '0' } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        ring: 'ring 2.6s cubic-bezier(0.2, 0.6, 0.3, 1) infinite',
        rise: 'rise 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
