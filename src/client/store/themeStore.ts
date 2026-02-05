import { create } from 'zustand';

type Theme = 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  (set) => ({
    theme: 'dark',
    setTheme: (theme) => {
      set({ theme });
      document.documentElement.classList.add('dark');
    },
  })
);

// Force dark mode on load
document.documentElement.classList.add('dark');

// Clear any stale light theme from localStorage
try {
  const stored = localStorage.getItem('claude-tv-theme');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed?.state?.theme === 'light') {
      localStorage.removeItem('claude-tv-theme');
    }
  }
} catch {}
