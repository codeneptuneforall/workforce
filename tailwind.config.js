export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F2FB',
          100: '#EBE4F7',
          200: '#D5C7EE',
          300: '#B8A1E0',
          400: '#9374CC',
          500: '#7350B8',
          600: '#5E3BA3',
          700: '#4C2E87',
          800: '#3C246B',
          900: '#2B1A4E',
        },
        ink: {
          DEFAULT: '#1E2125',
          2: '#3F444B',
          muted: '#646B75',
          faint: '#9AA0A8',
        },
        canvas: '#F6F7F9',
        line: '#E5E7EB',
        'line-strong': '#D1D5DB',
        ok: { DEFAULT: '#15803D', bg: '#ECFDF3', line: '#BBF7D0' },
        warn: { DEFAULT: '#B45309', bg: '#FFFBEB', line: '#FDE68A' },
        bad: { DEFAULT: '#B91C1C', bg: '#FEF2F2', line: '#FECACA' },
        info: { DEFAULT: '#1D4ED8', bg: '#EFF6FF', line: '#BFDBFE' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04)',
        pop: '0 12px 32px rgba(16, 24, 40, 0.14)',
      },
    },
  },
};
