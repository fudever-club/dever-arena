/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#0b0f19',
        surface: '#111827',
        card: '#1f2937',
        borderSubtle: 'rgba(255, 255, 255, 0.08)',
        fpt: {
          orange: '#ff6600',
          orangeHover: '#ff771a',
        },
        cyber: {
          cyan: '#00f0ff',
        },
        status: {
          ac: '#10b981',
          wa: '#ef4444',
          tle: '#f59e0b',
        },
        rank: {
          newbie: '#9e9e9e',
          pupil: '#4caf50',
          specialist: '#00b8a9',
          expert: '#3b5bdb',
          cm: '#aa00aa',
          master: '#ff8c00',
          gm: '#e53935',
        }
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      }
    },
  },
  plugins: [],
}
