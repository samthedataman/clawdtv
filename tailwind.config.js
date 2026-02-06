/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{js,ts,jsx,tsx}', './src/client/index.html'],
  darkMode: 'class',
  theme: {
    // Override borderRadius at top level - sharp edges everywhere
    borderRadius: {
      none: '0',
      DEFAULT: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '9999px', // Keep for functional circles (live dots, spinners)
    },
    extend: {
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      colors: {
        // Cyberpunk neon palette (keeping gh-* prefix for zero-touch component migration)
        'gh-bg-primary': '#0a0a0f',
        'gh-bg-secondary': '#0f0f1a',
        'gh-bg-tertiary': '#1a1a2e',
        'gh-border': '#1a1a3e',
        'gh-text-primary': '#e0e0ff',
        'gh-text-secondary': '#9a9aba',  // Improved contrast (WCAG AA compliant)
        'gh-accent-blue': '#00ffff',
        'gh-accent-green': '#00ff41',
        'gh-accent-green-dark': '#00cc33',
        'gh-accent-red': '#ff0040',
        'gh-accent-orange': '#ff6600',
        'gh-accent-purple': '#bf5af2',
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'SF Mono', 'Fira Code', 'Consolas', 'Monaco', '"Courier New"', 'monospace'],
        display: ['Orbitron', '"Share Tech Mono"', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'neon-cyan-sm': '0 0 5px rgba(0, 255, 255, 0.3), 0 0 10px rgba(0, 255, 255, 0.1)',
        'neon-cyan': '0 0 10px rgba(0, 255, 255, 0.4), 0 0 20px rgba(0, 255, 255, 0.2), 0 0 40px rgba(0, 255, 255, 0.1)',
        'neon-cyan-lg': '0 0 15px rgba(0, 255, 255, 0.5), 0 0 30px rgba(0, 255, 255, 0.3), 0 0 60px rgba(0, 255, 255, 0.15)',
        'neon-magenta-sm': '0 0 5px rgba(255, 0, 255, 0.3), 0 0 10px rgba(255, 0, 255, 0.1)',
        'neon-magenta': '0 0 10px rgba(255, 0, 255, 0.4), 0 0 20px rgba(255, 0, 255, 0.2), 0 0 40px rgba(255, 0, 255, 0.1)',
        'neon-green-sm': '0 0 5px rgba(0, 255, 65, 0.3), 0 0 10px rgba(0, 255, 65, 0.1)',
        'neon-green': '0 0 10px rgba(0, 255, 65, 0.4), 0 0 20px rgba(0, 255, 65, 0.2)',
        'neon-red': '0 0 10px rgba(255, 0, 64, 0.5), 0 0 20px rgba(255, 0, 64, 0.3)',
        'neon-red-lg': '0 0 15px rgba(255, 0, 64, 0.6), 0 0 30px rgba(255, 0, 64, 0.3), 0 0 60px rgba(255, 0, 64, 0.15)',
        'neon-violet': '0 0 10px rgba(191, 90, 242, 0.4), 0 0 20px rgba(191, 90, 242, 0.2)',
        'neon-orange': '0 0 10px rgba(255, 102, 0, 0.4), 0 0 20px rgba(255, 102, 0, 0.2)',
        'inner-glow-cyan': 'inset 0 0 15px rgba(0, 255, 255, 0.1)',
        'inner-glow-magenta': 'inset 0 0 15px rgba(255, 0, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideInFade 0.3s ease-out',
        'glow': 'neonGlow 2s ease-in-out infinite',
        'flicker': 'neonFlicker 3s linear infinite',
        'neon-pulse': 'neonPulse 2s ease-in-out infinite',
        'scanline': 'scanlineSweep 8s linear infinite',
        'glitch': 'glitch 0.3s ease-in-out',
        'cursor-blink': 'cursorBlink 1s step-end infinite',
      },
      keyframes: {
        slideInFade: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        neonGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 255, 255, 0.4), 0 0 10px rgba(0, 255, 255, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 255, 0.6), 0 0 40px rgba(0, 255, 255, 0.3)' },
        },
        neonFlicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.6' },
        },
        neonPulse: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 0, 64, 0.5), 0 0 10px rgba(255, 0, 64, 0.3)' },
          '50%': { boxShadow: '0 0 15px rgba(255, 0, 64, 0.8), 0 0 30px rgba(255, 0, 64, 0.5), 0 0 45px rgba(255, 0, 64, 0.2)' },
        },
        scanlineSweep: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        glitch: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' },
        },
        cursorBlink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
