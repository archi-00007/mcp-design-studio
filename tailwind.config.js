/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4C5BD4',
          hover: '#4150C4',
          soft: '#EFF1FC',
          line: '#D3D8F5',
        },
        ink: {
          DEFAULT: '#16181D',
          sub: '#5A616C',
          mute: '#8A9099',
          faint: '#B4BAC3',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          sunken: '#F7F8FA',
          hover: '#FAFBFC',
        },
        line: {
          DEFAULT: '#E6E8EC',
          soft: '#EDEFF3',
        },
        ok: '#2E9E72',
        warn: '#C6802A',
        danger: {
          DEFAULT: '#C0483E',
          soft: '#FCEEEC',
          line: '#E8C9C4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        ctl: '7px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,24,29,0.04)',
        pop: '0 8px 24px -4px rgba(22,24,29,0.12), 0 2px 6px rgba(22,24,29,0.06)',
        modal: '0 24px 64px -12px rgba(22,24,29,0.22)',
      },
    },
  },
  plugins: [],
}
