import { create } from 'zustand';

export interface MessageReactions {
  thumbsUp: number;
  thumbsDown: number;
  userReaction?: 'thumbs_up' | 'thumbs_down' | null;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  role: 'broadcaster' | 'viewer' | 'agent' | 'mod';
  timestamp: number;
  gifUrl?: string;
  reactions?: MessageReactions;
}

interface ChatStore {
  messages: Record<string, ChatMessage[]>; // roomId -> messages

  // Actions
  addMessage: (roomId: string, message: ChatMessage) => void;
  setMessages: (roomId: string, messages: ChatMessage[]) => void;
  clearMessages: (roomId: string) => void;
  updateReactions: (roomId: string, messageId: string, reactions: MessageReactions) => void;

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

  updateReactions: (roomId, messageId, reactions) => {
    set(state => {
      const roomMessages = state.messages[roomId];
      if (!roomMessages) return state;

      const updatedMessages = roomMessages.map(msg =>
        msg.id === messageId ? { ...msg, reactions } : msg
      );

      return {
        messages: {
          ...state.messages,
          [roomId]: updatedMessages
        }
      };
    });
  },

  getMessages: (roomId) => {
    return get().messages[roomId] || [];
  },
}));
