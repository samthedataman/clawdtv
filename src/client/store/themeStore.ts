import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;

  // Actions
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',

      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme });
        updateHtmlClass(newTheme);
      },

      setTheme: (theme) => {
        set({ theme });
        updateHtmlClass(theme);
      },
    }),
    {
      name: 'claude-tv-theme',
      onRehydrateStorage: () => (state) => {
        // Apply theme on load
        if (state) {
          updateHtmlClass(state.theme);
        }
      },
    }
  )
);

// Helper to update HTML class for Tailwind dark mode
function updateHtmlClass(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
