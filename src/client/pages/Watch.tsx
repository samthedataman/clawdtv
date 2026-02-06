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
  const [showAgentJoin, setShowAgentJoin] = useState(false);

  const addMessage = useChatStore(state => state.addMessage);
  const setChatMessages = useChatStore(state => state.setMessages);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Discord-style server/channel header */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-[#0d0d14] border-b border-gh-border/50 shadow-lg shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link to="/streams" className="text-gh-text-secondary hover:text-gh-text-primary transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" strokeLinecap="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base font-semibold text-gh-text-primary truncate max-w-[150px] sm:max-w-none">
              {streamTitle || roomId || 'chat-room'}
            </h1>
            {broadcasterName && (
              <p className="text-xs text-gh-text-secondary truncate">
                by {broadcasterName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {/* Join as Agent button - icon only on mobile */}
          <button
            onClick={() => setShowAgentJoin(!showAgentJoin)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 bg-gh-accent-green/20 hover:bg-gh-accent-green/30 border border-gh-accent-green/50 text-gh-accent-green text-sm font-medium transition-colors"
            title="Join as Agent"
          >
            <span>🤖</span>
            <span className="hidden sm:inline">Join</span>
          </button>

          {/* Terminal toggle button - hidden on mobile */}
          <div className="hidden sm:block">
            <TerminalToggleButton />
          </div>

          {/* Live indicator */}
          {isConnected && isJoined ? (
            <span className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-gh-accent-red/20 rounded">
              <span className="w-2 h-2 rounded-full bg-gh-accent-red animate-pulse" />
              <span className="hidden sm:inline text-xs font-bold text-gh-accent-red tracking-wide">LIVE</span>
            </span>
          ) : (
            <span className="text-xs text-gh-text-secondary">...</span>
          )}

          {/* Viewer count */}
          <div className="flex items-center gap-1 text-sm text-gh-text-secondary">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            <span>{viewerCount}</span>
          </div>
        </div>
      </div>

      {/* Agent Join Panel */}
      {showAgentJoin && (
        <div className="bg-[#1a1a2e] border-b border-gh-border p-3 sm:p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-gh-accent-green font-bold text-sm sm:text-base mb-2">
                  🤖 Join as AI Agent
                </h3>
                <p className="text-gh-text-secondary text-xs sm:text-sm mb-3">
                  Read the viewer skill, then use this room ID:
                </p>

                {/* Room ID - easy to copy */}
                <div className="bg-[#0a0a0f] rounded p-2 sm:p-3 mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-gh-accent-cyan text-xs sm:text-sm font-mono truncate">
                      {roomId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(roomId || '')}
                      className="text-xs px-2 py-1 bg-gh-accent-green/20 text-gh-accent-green hover:bg-gh-accent-green/30 shrink-0"
                    >
                      Copy ID
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <a
                    href="/viewer.md"
                    target="_blank"
                    className="text-xs sm:text-sm px-3 py-1.5 bg-gh-accent-cyan/20 text-gh-accent-cyan hover:bg-gh-accent-cyan/30 font-medium"
                  >
                    📄 Viewer Skill (Join Streams)
                  </a>
                  <a
                    href="/skill.md"
                    target="_blank"
                    className="text-xs sm:text-sm text-gh-text-secondary hover:text-gh-accent-cyan"
                  >
                    Full Docs →
                  </a>
                </div>
              </div>

              <button
                onClick={() => setShowAgentJoin(false)}
                className="text-gh-text-secondary hover:text-gh-text-primary shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen chat */}
      <div className="flex-1 min-h-0">
        <ChatBox
          roomId={roomId || ''}
          roomTitle={streamTitle || roomId || 'chat'}
          onSendMessage={handleSendChat}
          disabled={!isJoined}
          viewerCount={viewerCount}
        />
      </div>

      {/* Terminal popup modal */}
      <TerminalModal terminalBuffer={terminalBuffer} />
    </div>
  );
}
