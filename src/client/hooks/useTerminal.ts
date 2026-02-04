import { useRef, useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

interface UseTerminalOptions {
  roomId: string;
  onJoinSuccess?: (data: any) => void;
  onStreamEnd?: () => void;
}

export function useTerminal({ roomId, onJoinSuccess, onStreamEnd }: UseTerminalOptions) {
  const [terminalBuffer, setTerminalBuffer] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const addMessage = useChatStore(state => state.addMessage);
  const setMessages = useChatStore(state => state.setMessages);
  const username = useAuthStore(state => state.username);
  const authSentRef = useRef(false);

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'auth_response':
        if (data.success) {
          console.log('[Terminal] Authenticated as:', data.username);
          // After auth, join the stream
          send({ type: 'join_stream', roomId });
        }
        break;

      case 'join_stream_response':
        if (data.success && data.stream) {
          console.log('[Terminal] Joined stream:', data.stream.title);
          setIsJoined(true);
          setStreamInfo(data.stream);
          setViewerCount(data.stream.viewerCount || 0);

          // Set initial terminal buffer
          if (data.terminalBuffer) {
            setTerminalBuffer(data.terminalBuffer);
          }

          // Set recent messages
          if (Array.isArray(data.recentMessages)) {
            setMessages(roomId, data.recentMessages);
          }

          onJoinSuccess?.(data);
        } else {
          console.error('[Terminal] Failed to join stream:', data.error);
        }
        break;

      case 'terminal':
        // Append terminal data
        setTerminalBuffer(prev => prev + data.data);
        break;

      case 'chat':
        // Add chat message
        addMessage(roomId, {
          id: data.id,
          userId: data.userId || data.username,
          username: data.username,
          content: data.content,
          role: data.role || 'viewer',
          timestamp: data.timestamp,
          gifUrl: data.gifUrl,
        });
        break;

      case 'viewer_count':
        setViewerCount(data.count);
        break;

      case 'stream_end':
        console.log('[Terminal] Stream ended');
        onStreamEnd?.();
        break;

      default:
        // Ignore unknown message types
        break;
    }
  }, [roomId, addMessage, setMessages, onJoinSuccess, onStreamEnd]);

  const handleConnect = useCallback(() => {
    console.log('[Terminal] WebSocket connected');
    authSentRef.current = false; // Reset auth flag
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('[Terminal] WebSocket disconnected');
    setIsJoined(false);
  }, []);

  const { isConnected, send } = useWebSocket({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  });

  // Send auth message when connected
  useCallback(() => {
    if (isConnected && !authSentRef.current) {
      const authUsername = username || localStorage.getItem('username') || `Anon${Math.floor(Math.random() * 10000)}`;
      console.log('[Terminal] Sending auth:', authUsername);
      send({ type: 'auth', username: authUsername, role: 'viewer' });
      authSentRef.current = true;
    }
  }, [isConnected, username, send])();

  const sendChat = useCallback((content: string, gifUrl?: string) => {
    if (!isJoined) {
      console.warn('[Terminal] Cannot send chat - not joined');
      return false;
    }
    return send({ type: 'send_chat', content, gifUrl });
  }, [isJoined, send]);

  return {
    isConnected,
    isJoined,
    terminalBuffer,
    viewerCount,
    streamInfo,
    sendChat,
    send,
  };
}
