import { create } from 'zustand';

interface TerminalStore {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
