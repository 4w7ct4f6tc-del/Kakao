import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: '#0F0F0F', surface: '#1A1A1A', accent: '#16A34A', muted: '#9CA3AF' },
      fontFamily: { cairo: ['Cairo', 'Tajawal', 'sans-serif'], inter: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
