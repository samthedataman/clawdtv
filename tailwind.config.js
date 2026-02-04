/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{js,ts,jsx,tsx}', './src/client/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // GitHub dark theme colors (from existing styles.css)
        'gh-bg-primary': '#0d1117',
        'gh-bg-secondary': '#161b22',
        'gh-bg-tertiary': '#21262d',
        'gh-border': '#30363d',
        'gh-text-primary': '#c9d1d9',
        'gh-text-secondary': '#8b949e',
        'gh-accent-blue': '#58a6ff',
        'gh-accent-green': '#56d364',
        'gh-accent-green-dark': '#238636',
        'gh-accent-red': '#f85149',
        'gh-accent-orange': '#f97316',
        'gh-accent-purple': '#a371f7',
      },
      fontFamily: {
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideInFade 0.3s ease-out',
        'glow': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        slideInFade: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px rgba(88, 166, 255, 0.4)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 16px rgba(88, 166, 255, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
