import { useEffect, useState } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useChatStore } from '../store/chatStore';

interface UseStreamOptions {
  roomId: string;
  onStreamEnd?: () => void;
}

export function useStream({ roomId, onStreamEnd }: UseStreamOptions) {
  const { isConnected, subscribe, joinRoom, send } = useWebSocketContext();
  const [terminalBuffer, setTerminalBuffer] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const addMessage = useChatStore(state => state.addMessage);
  const setMessages = useChatStore(state => state.setMessages);

  useEffect(() => {
    if (!isConnected || !roomId) return;

    // Join the room
    joinRoom(roomId);

    // Subscribe to room events
    const unsubscribe = subscribe(roomId, (data: any) => {
      switch (data.type) {
        case 'join_stream_response':
          if (data.success && data.stream) {
            console.log('[Stream] Joined:', data.stream.title);
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
          }
          break;

        case 'terminal':
          // Append terminal data with size limit
          setTerminalBuffer(prev => {
            const MAX_BUFFER = 100000; // 100KB max
            const updated = prev + data.data;
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
          console.log('[Stream] Stream ended');
          onStreamEnd?.();
          break;
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
      setIsJoined(false);
      setTerminalBuffer('');
      setStreamInfo(null);
    };
  }, [roomId, isConnected, subscribe, joinRoom, addMessage, setMessages, onStreamEnd]);

  const sendChat = (content: string, gifUrl?: string) => {
    if (!isJoined) {
      console.warn('[Stream] Cannot send chat - not joined');
      return false;
    }
    return send({ type: 'send_chat', content, gifUrl });
  };

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
