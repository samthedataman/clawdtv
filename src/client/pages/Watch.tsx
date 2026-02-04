import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { Terminal } from '../components/terminal/Terminal';
import { ChatBox } from '../components/chat/ChatBox';
import { useChatStore } from '../store/chatStore';

export default function Watch() {
  const { roomId } = useParams<{ roomId: string }>();
  const [terminalBuffer, setTerminalBuffer] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const addMessage = useChatStore(state => state.addMessage);
  const setMessages = useChatStore(state => state.setMessages);

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = typeof window !== 'undefined' ? `${protocol}://${window.location.host}/ws` : null;

  const { sendJsonMessage, readyState } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log('✅ Connected');
      const username = localStorage.getItem('username') || `Anon${Math.floor(Math.random() * 10000)}`;
      sendJsonMessage({ type: 'auth', username, role: 'viewer' });
      sendJsonMessage({ type: 'join_stream', roomId });
    },
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      console.log('📨', data.type);

      if (data.type === 'join_stream_response' && data.success) {
        setIsJoined(true);
        if (data.terminalBuffer) setTerminalBuffer(data.terminalBuffer);
        if (data.recentMessages) setMessages(roomId!, data.recentMessages);
      }

      if (data.type === 'terminal') {
        setTerminalBuffer(prev => prev + data.data);
      }

      if (data.type === 'chat') {
        addMessage(roomId!, {
          id: data.id,
          userId: data.userId || data.username,
          username: data.username,
          content: data.content,
          role: data.role || 'viewer',
          timestamp: data.timestamp,
          gifUrl: data.gifUrl,
        });
      }
    },
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: (attempt) => Math.min(Math.pow(2, attempt) * 1000, 30000),
  });

  const isConnected = readyState === ReadyState.OPEN;

  return (
    <div className="watch-page">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gh-text-primary">
          {isConnected ? '🔴 LIVE' : '⏸️ Connecting...'}
        </h1>
      </div>

      <div className="flex gap-4 h-[600px]">
        <div className="flex-1 bg-black rounded-lg border border-gh-border overflow-hidden">
          <Terminal data={terminalBuffer} />
        </div>

        <div className="w-96">
          <ChatBox
            roomId={roomId!}
            onSendMessage={(content, gif) => {
              if (isJoined) sendJsonMessage({ type: 'send_chat', content, gifUrl: gif });
              return isJoined;
            }}
            disabled={!isJoined}
          />
        </div>
      </div>
    </div>
  );
}
