import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { Terminal } from '../components/terminal/Terminal';
import { ChatBox } from '../components/chat/ChatBox';
import { useTerminalFormatter } from '../hooks/useTerminalFormatter';
import { useChatStore } from '../store/chatStore';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Watch() {
  const { roomId } = useParams<{ roomId: string }>();
  const isMobile = useIsMobile();
  const [terminalBuffer, setTerminalBuffer] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');

  const addMessage = useChatStore(state => state.addMessage);
  const setChatMessages = useChatStore(state => state.setMessages);

  const { format, reset } = useTerminalFormatter(true);

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = typeof window !== 'undefined' ? `${protocol}://${window.location.host}/ws` : null;

  const { sendJsonMessage, readyState } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log('[Watch] Connected');
      reset();
      const username = `Anon${Math.floor(Math.random() * 10000)}`;
      sendJsonMessage({ type: 'auth', username, role: 'viewer' });
      sendJsonMessage({ type: 'join_stream', roomId });
    },
    onMessage: (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'join_stream_response' && data.success) {
        setIsJoined(true);
        if (data.stream?.title) setStreamTitle(data.stream.title);
        if (data.stream?.viewerCount) setViewerCount(data.stream.viewerCount);
        if (data.terminalBuffer) setTerminalBuffer(format(data.terminalBuffer));
        if (Array.isArray(data.recentMessages)) {
          setChatMessages(roomId || '', data.recentMessages);
        }
      }

      if (data.type === 'terminal') {
        setTerminalBuffer(prev => prev + format(data.data));
      }

      if (data.type === 'chat') {
        addMessage(roomId || '', {
          id: data.id,
          userId: data.userId || data.username,
          username: data.username,
          content: data.content,
          role: data.role || 'viewer',
          timestamp: data.timestamp,
          gifUrl: data.gifUrl,
        });
      }

      if (data.type === 'viewer_count') {
        setViewerCount(data.count);
      }
    },
    shouldReconnect: () => true,
  });

  const isConnected = readyState === ReadyState.OPEN;

  const handleSendChat = (content: string, gifUrl?: string) => {
    if (!isJoined) return;
    sendJsonMessage({ type: 'send_chat', content, gifUrl });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Stream info header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gh-bg-secondary border-b border-gh-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {isConnected ? (
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-gh-accent-red animate-pulse" />
              <span className="text-sm font-semibold text-gh-accent-red">LIVE</span>
            </span>
          ) : (
            <span className="text-sm font-semibold text-gh-text-secondary shrink-0">
              Connecting...
            </span>
          )}
          <h1 className="text-sm font-semibold text-gh-text-primary truncate">
            {streamTitle || roomId}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-gh-text-secondary shrink-0">
          <span>{viewerCount} viewer{viewerCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Main content: Terminal (2/3) + Chat (1/3) */}
      <div
        className="flex-1 min-h-0"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
          gridTemplateRows: isMobile ? '3fr 2fr' : '1fr',
        }}
      >
        {/* Terminal panel */}
        <div className={`min-h-0 min-w-0 bg-gh-bg-primary overflow-hidden ${isMobile ? 'border-b border-gh-border' : ''}`}>
          <Terminal data={terminalBuffer} />
        </div>

        {/* Chat panel */}
        <div className="min-h-0 min-w-0 h-full">
          <ChatBox
            roomId={roomId || ''}
            onSendMessage={handleSendChat}
            disabled={!isJoined}
          />
        </div>
      </div>
    </div>
  );
}
