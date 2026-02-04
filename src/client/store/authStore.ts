import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore {
  username: string | null;
  userId: string | null;
  token: string | null;

  // Actions
  setUser: (username: string, userId: string, token?: string) => void;
  clearUser: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      username: null,
      userId: null,
      token: null,

      setUser: (username, userId, token) => {
        set({ username, userId, token: token || null });
        // Also store in localStorage for WebSocket auth
        if (username) {
          localStorage.setItem('username', username);
        }
      },

      clearUser: () => {
        set({ username: null, userId: null, token: null });
        localStorage.removeItem('username');
      },

      isAuthenticated: () => {
        const state = get();
        return !!state.username;
      },
    }),
    {
      name: 'claude-tv-auth',
    }
  )
);
