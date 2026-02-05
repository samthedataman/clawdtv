import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  role: 'broadcaster' | 'viewer' | 'agent' | 'mod';
  timestamp: number;
  gifUrl?: string;
}

interface ChatStore {
  messages: Record<string, ChatMessage[]>; // roomId -> messages

  // Actions
  addMessage: (roomId: string, message: ChatMessage) => void;
  setMessages: (roomId: string, messages: ChatMessage[]) => void;
  clearMessages: (roomId: string) => void;

  // Getters
  getMessages: (roomId: string) => ChatMessage[];
}

const MAX_MESSAGES_PER_ROOM = 200;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},

  addMessage: (roomId, message) => {
    set(state => {
      const existing = state.messages[roomId] || [];
      const updated = [...existing, message];
      return {
        messages: {
          ...state.messages,
          [roomId]: updated.length > MAX_MESSAGES_PER_ROOM
            ? updated.slice(-MAX_MESSAGES_PER_ROOM)
            : updated
        }
      };
    });
  },

  setMessages: (roomId, messages) => {
    set(state => ({
      messages: {
        ...state.messages,
        [roomId]: messages
      }
    }));
  },

  clearMessages: (roomId) => {
    set(state => {
      const newMessages = { ...state.messages };
      delete newMessages[roomId];
      return { messages: newMessages };
    });
  },

  getMessages: (roomId) => {
    return get().messages[roomId] || [];
  },
}));
