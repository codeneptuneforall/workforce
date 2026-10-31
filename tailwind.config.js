export default {
  content: [
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
          subtle: '#667085',
          faint: '#9AA0A8',
        },
        canvas: '#F6F7F9',
        surface: '#FFFFFF',
        line: {
          DEFAULT: '#E5E7EB',
          strong: '#D1D5DB',
        },
        accent: {
          DEFAULT: '#2B59C3',
          hover: '#234AA6',
          soft: '#EEF2FC',
          ink: '#1F4296',
          line: '#C7D4F3',
        },
        sidebar: {
          DEFAULT: '#0F1729',
          hover: '#1A2540',
          active: '#24314F',
          text: '#C3CBDB',
          muted: '#7D8AA5',
          line: '#1F2A44',
        },
        danger: {
          DEFAULT: '#D92D20',
          soft: '#FEF3F2',
          ink: '#B42318',
          line: '#FECDCA',
        },
        warning: {
          DEFAULT: '#DC6803',
          soft: '#FFFAEB',
          ink: '#B54708',
          line: '#FEDF89',
        },
        ok: { DEFAULT: '#15803D', bg: '#ECFDF3', line: '#BBF7D0' },
        warn: { DEFAULT: '#B45309', bg: '#FFFBEB', line: '#FDE68A' },
        bad: { DEFAULT: '#B91C1C', bg: '#FEF2F2', line: '#FECACA' },
        success: {
          DEFAULT: '#079455',
          soft: '#ECFDF3',
          ink: '#067647',
          line: '#ABEFC6',
        },
        info: {
          DEFAULT: '#1D4ED8',
          bg: '#EFF6FF',
          line: '#BFDBFE',
          soft: '#EFF8FF',
          ink: '#175CD3',
        },
        violet: {
          DEFAULT: '#7A5AF8',
          soft: '#F4F3FF',
          ink: '#5925DC',
          line: '#D9D6FE',
        },
        teal: {
          DEFAULT: '#0E9384',
          soft: '#F0FDF9',
          ink: '#107569',
          line: '#99F6E0',
        },
        neutral: {
          DEFAULT: '#667085',
          soft: '#F2F4F7',
          ink: '#344054',
          line: '#E4E7EC',
        },
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