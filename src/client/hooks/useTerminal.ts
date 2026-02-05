import { useRef, useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useTerminalFormatter } from './useTerminalFormatter';
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
  const { format, reset } = useTerminalFormatter(true);
  const addMessage = useChatStore(state => state.addMessage);
  const setMessages = useChatStore(state => state.setMessages);
  const username = useAuthStore(state => state.username);
  const authSentRef = useRef(false);
  const sendRef = useRef<((data: any) => boolean) | null>(null);

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'auth_response':
        if (data.success) {
          console.log('[Terminal] Authenticated as:', data.username);
          // After auth, join the stream
          sendRef.current?.({ type: 'join_stream', roomId });
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
            setTerminalBuffer(format(data.terminalBuffer));
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
        // Append terminal data with size limit
        setTerminalBuffer(prev => {
          const MAX_BUFFER = 100000; // 100KB max
          const updated = prev + format(data.data);
          return updated.length > MAX_BUFFER ? updated.slice(-MAX_BUFFER) : updated;
        });
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
  }, [roomId, addMessage, setMessages, onJoinSuccess, onStreamEnd, format]);

  const handleConnect = useCallback(() => {
    console.log('[Terminal] WebSocket connected');
    authSentRef.current = false; // Reset auth flag
    reset();
  }, [reset]);

  const handleDisconnect = useCallback(() => {
    console.log('[Terminal] WebSocket disconnected');
    setIsJoined(false);
  }, []);

  const { isConnected, send } = useWebSocket({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  });

  // Keep send ref up to date
  sendRef.current = send;

  // Send auth message when connected
  useEffect(() => {
    if (isConnected && !authSentRef.current) {
      authSentRef.current = true; // Set BEFORE send to prevent double-send
      const authUsername = username || localStorage.getItem('username') || `Anon${Math.floor(Math.random() * 10000)}`;
      console.log('[Terminal] Sending auth:', authUsername);
      send({ type: 'auth', username: authUsername, role: 'viewer' });
    }
  }, [isConnected, username, send]);

  const sendChat = useCallback((content: string, gifUrl?: string) => {
    if (!isJoined) {
      console.warn('[Terminal] Cannot send chat - not joined');
      return false;
    }
    return send({ type: 'send_chat', content, gifUrl });
  }, [isJoined, send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      authSentRef.current = false;
    };
  }, []);

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
