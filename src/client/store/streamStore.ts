import { create } from 'zustand';

export interface Stream {
  id: string;
  title: string;
  ownerId: string;
  ownerUsername: string;
  viewerCount: number;
  startedAt: number;
  isPrivate: boolean;
  topics?: string[];
  needsHelp?: boolean;
  helpWith?: string;
  objective?: string;
  context?: string;
}

interface StreamStore {
  streams: Stream[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTopics: string[];
  sortBy: 'viewers' | 'newest' | 'oldest';

  // Actions
  fetchStreams: () => Promise<void>;
  updateViewerCount: (roomId: string, count: number) => void;
  setSearchQuery: (query: string) => void;
  toggleTopic: (topic: string) => void;
  setSortBy: (sort: 'viewers' | 'newest' | 'oldest') => void;
  clearFilters: () => void;

  // Computed
  getFilteredStreams: () => Stream[];
}

export const useStreamStore = create<StreamStore>((set, get) => ({
  streams: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedTopics: [],
  sortBy: 'viewers',

  fetchStreams: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/streams');
      const data = await res.json();
      if (data.success) {
        set({ streams: data.data, loading: false });
      } else {
        set({ error: data.error || 'Failed to fetch streams', loading: false });
      }
    } catch (err) {
      set({ error: 'Network error', loading: false });
    }
  },

  updateViewerCount: (roomId, count) => {
    set(state => ({
      streams: state.streams.map(s =>
        s.id === roomId ? { ...s, viewerCount: count } : s
      )
    }));
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleTopic: (topic) => {
    set(state => ({
      selectedTopics: state.selectedTopics.includes(topic)
        ? state.selectedTopics.filter(t => t !== topic)
        : [...state.selectedTopics, topic]
    }));
  },

  setSortBy: (sort) => set({ sortBy: sort }),

  clearFilters: () => set({ searchQuery: '', selectedTopics: [], sortBy: 'viewers' }),

  getFilteredStreams: () => {
    const { streams, searchQuery, selectedTopics, sortBy } = get();

    let filtered = [...streams];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.ownerUsername.toLowerCase().includes(query) ||
        s.topics?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Topic filter
    if (selectedTopics.length > 0) {
      filtered = filtered.filter(s =>
        s.topics?.some(t => selectedTopics.includes(t))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'viewers':
          return b.viewerCount - a.viewerCount;
        case 'newest':
          return b.startedAt - a.startedAt;
        case 'oldest':
          return a.startedAt - b.startedAt;
        default:
          return 0;
      }
    });

    return filtered;
  },
}));
