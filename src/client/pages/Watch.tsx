import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { ChatBox } from '../components/chat/ChatBox';
import { TerminalModal, TerminalToggleButton } from '../components/terminal/TerminalModal';
import { useChatStore } from '../store/chatStore';

export default function Watch() {
  const { roomId } = useParams<{ roomId: string }>();
  const [isJoined, setIsJoined] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [broadcasterName, setBroadcasterName] = useState('');
  const [terminalBuffer, setTerminalBuffer] = useState('');

  const addMessage = useChatStore(state => state.addMessage);
  const setChatMessages = useChatStore(state => state.setMessages);
  const updateReactions = useChatStore(state => state.updateReactions);

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = typeof window !== 'undefined' ? `${protocol}://${window.location.host}/ws` : null;

  const { sendJsonMessage, readyState } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log('[Watch] Connected');
      setTerminalBuffer('');
      const username = `Anon${Math.floor(Math.random() * 10000)}`;
      sendJsonMessage({ type: 'auth', username, role: 'viewer' });
      sendJsonMessage({ type: 'join_stream', roomId });
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'join_stream_response' && data.success) {
          setIsJoined(true);
          if (data.stream?.title) setStreamTitle(data.stream.title);
          if (data.stream?.viewerCount) setViewerCount(data.stream.viewerCount);
          if (data.stream?.broadcasterName) setBroadcasterName(data.stream.broadcasterName);
          if (data.terminalBuffer) setTerminalBuffer(data.terminalBuffer);
          if (Array.isArray(data.recentMessages)) {
            setChatMessages(roomId || '', data.recentMessages);
          }
        }

        // Accumulate terminal data for popup view
        if (data.type === 'terminal' && data.data) {
          const MAX_BUFFER = 100000;
          setTerminalBuffer(prev => {
            const updated = prev + data.data;
            return updated.length > MAX_BUFFER ? updated.slice(-MAX_BUFFER) : updated;
          });
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
            reactions: data.reactions,
          });
        }

        // Handle reaction updates
        if (data.type === 'reaction_update') {
          updateReactions(roomId || '', data.messageId, {
            thumbsUp: data.thumbsUp,
            thumbsDown: data.thumbsDown,
            userReaction: data.userReaction,
          });
        }

        if (data.type === 'viewer_count') {
          setViewerCount(data.count);
        }

        if (data.type === 'viewer_join') {
          setViewerCount(data.viewerCount);
        }

        if (data.type === 'viewer_leave') {
          setViewerCount(data.viewerCount);
        }
      } catch (e) {
        console.error('[Watch] Invalid WebSocket message:', e);
      }
    },
    shouldReconnect: () => true,
  });

  const isConnected = readyState === ReadyState.OPEN;

  const handleSendChat = (content: string, gifUrl?: string) => {
    if (!isJoined) return;
    sendJsonMessage({ type: 'send_chat', content, gifUrl });
  };

  const handleReact = (messageId: string, reaction: 'thumbs_up' | 'thumbs_down' | null) => {
    if (!isJoined) return;
    sendJsonMessage({ type: 'message_reaction', messageId, reaction });
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Discord-style server/channel header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d0d14] border-b border-gh-border/50 shadow-lg shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/streams" className="text-gh-text-secondary hover:text-gh-text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" strokeLinecap="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-gh-text-secondary text-xl">#</span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gh-text-primary truncate">
                {streamTitle || roomId || 'chat-room'}
              </h1>
              {broadcasterName && (
                <p className="text-xs text-gh-text-secondary truncate">
                  Hosted by {broadcasterName}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Terminal toggle button */}
          <TerminalToggleButton />

          {/* Live indicator */}
          {isConnected && isJoined ? (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-gh-accent-red/20 rounded">
              <span className="w-2 h-2 rounded-full bg-gh-accent-red animate-pulse" />
              <span className="text-xs font-bold text-gh-accent-red tracking-wide">LIVE</span>
            </span>
          ) : (
            <span className="text-xs text-gh-text-secondary">
              {isConnected ? 'Joining...' : 'Connecting...'}
            </span>
          )}

          {/* Viewer count */}
          <div className="flex items-center gap-1.5 text-sm text-gh-text-secondary">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            <span>{viewerCount}</span>
          </div>
        </div>
      </div>

      {/* Full-screen chat */}
      <div className="flex-1 min-h-0">
        <ChatBox
          roomId={roomId || ''}
          roomTitle={streamTitle || roomId || 'chat'}
          onSendMessage={handleSendChat}
          onReact={handleReact}
          disabled={!isJoined}
          viewerCount={viewerCount}
        />
      </div>

      {/* Terminal popup modal */}
      <TerminalModal terminalBuffer={terminalBuffer} />
    </div>
  );
}
