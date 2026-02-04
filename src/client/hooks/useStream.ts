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
    console.log(`[useStream] 🎬 Effect running for room: ${roomId}`);
    console.log(`[useStream] 📊 isConnected: ${isConnected}`);

    if (!isConnected || !roomId) {
      console.log('[useStream] ⏸️ Skipping - not connected or no roomId');
      return;
    }

    console.log(`[useStream] 🚀 Initializing stream for room: ${roomId}`);

    // Join the room
    joinRoom(roomId);

    // Subscribe to room events
    const unsubscribe = subscribe(roomId, (data: any) => {
      console.log(`[useStream] 📨 Received message for room ${roomId}:`, data.type);

      switch (data.type) {
        case 'join_stream_response':
          if (data.success && data.stream) {
            console.log('[useStream] ✅ Successfully joined stream:', data.stream.title);
            console.log('[useStream] 📊 Stream data:', {
              viewerCount: data.stream.viewerCount,
              hasTerminalBuffer: !!data.terminalBuffer,
              messageCount: data.recentMessages?.length || 0
            });
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
          console.log('[useStream] 📟 Received terminal data:', data.data?.length, 'bytes');
          // Append terminal data with size limit
          setTerminalBuffer(prev => {
            const MAX_BUFFER = 100000; // 100KB max
            const updated = prev + data.data;
            const final = updated.length > MAX_BUFFER ? updated.slice(-MAX_BUFFER) : updated;
            console.log(`[useStream] 📊 Terminal buffer: ${final.length} bytes`);
            return final;
          });
          break;

        case 'chat':
          console.log('[useStream] 💬 Received chat message:', data.username, ':', data.content?.substring(0, 50));
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
          console.log('[useStream] 👥 Viewer count updated:', data.count);
          setViewerCount(data.count);
          break;

        case 'stream_end':
          console.log('[useStream] 🛑 Stream ended - calling onStreamEnd callback');
          onStreamEnd?.();
          break;

        default:
          console.log(`[useStream] ❓ Unknown message type: ${data.type}`);
          break;
      }
    });

    // Cleanup
    return () => {
      console.log(`[useStream] 🧹 Cleaning up room: ${roomId}`);
      unsubscribe();
      setIsJoined(false);
      setTerminalBuffer('');
      setStreamInfo(null);
    };
  }, [roomId, isConnected]); // Only depend on roomId and isConnected - context functions are stable

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
