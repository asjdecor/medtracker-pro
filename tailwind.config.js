/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), muted: v('muted'), line: v('line'),
        ink: v('ink'), sub: v('sub'), faint: v('faint'),
        brand: v('brand'), 'brand-strong': v('brand-strong'), 'on-brand': v('on-brand'),
        accent: v('accent'), ok: v('ok'), warn: v('warn'), danger: v('danger'),
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
    },
  },
  plugins: [],
}
