import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { Terminal } from '../components/terminal/Terminal';
import { ChatBox } from '../components/chat/ChatBox';
import { useChatStore } from '../store/chatStore';

interface StreamStatus {
  isLive: boolean;
  title: string;
  ownerUsername: string;
  endedAt?: number;
}

export default function Watch() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check stream status before attempting WebSocket connection
  useEffect(() => {
    if (!roomId) return;

    const checkStreamStatus = async () => {
      try {
        const res = await fetch(`/api/streams/${roomId}`);
        const data = await res.json();

        if (!data.success) {
          setError('Stream not found');
          setLoading(false);
          return;
        }

        const stream = data.data;
        setStreamStatus({
          isLive: stream.isLive,
          title: stream.title,
          ownerUsername: stream.ownerUsername,
          endedAt: stream.endedAt,
        });

        setLoading(false);
      } catch (err) {
        setError('Failed to load stream');
        setLoading(false);
      }
    };

    checkStreamStatus();
  }, [roomId]);

  // Separate effect for navigation to prevent state updates during render
  useEffect(() => {
    if (streamStatus && !streamStatus.isLive) {
      navigate(`/chat/${roomId}`, { replace: true });
    }
  }, [streamStatus, navigate, roomId]);

  if (!roomId) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">❌</div>
        <h3 className="text-xl font-semibold text-gh-text-primary mb-2">Invalid Room ID</h3>
        <Link to="/streams" className="text-gh-accent-blue hover:underline">
          ← Back to Streams
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4 animate-pulse">📺</div>
        <p className="text-gh-text-secondary">Loading stream...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📺</div>
        <h3 className="text-xl font-semibold text-gh-text-primary mb-2">{error}</h3>
        <p className="text-gh-text-secondary mb-4">This stream may have ended or doesn't exist.</p>
        <div className="flex justify-center gap-4">
          <Link to="/streams" className="text-gh-accent-blue hover:underline">
            Browse Live Streams
          </Link>
          <Link to="/history" className="text-gh-accent-blue hover:underline">
            View Archive
          </Link>
        </div>
      </div>
    );
  }

  // Only render the live stream view if stream is confirmed live
  return <LiveStreamView roomId={roomId} initialTitle={streamStatus?.title} />;
}

// Separate component for the actual live stream view
function LiveStreamView({ roomId, initialTitle }: { roomId: string; initialTitle?: string }) {
  const navigate = useNavigate();
  const [terminalBuffer, setTerminalBuffer] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const addMessage = useChatStore(state => state.addMessage);
  const setMessages = useChatStore(state => state.setMessages);

  // Get WebSocket URL
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = typeof window !== 'undefined' ? `${protocol}://${window.location.host}/ws` : null;

  // Use the library - handles all the complex stuff for us!
  const { sendJsonMessage, readyState } = useWebSocket(
    wsUrl,
    {
      onOpen: () => {
        console.log('✅ [WebSocket] Connected');

        // Send auth
        const username = localStorage.getItem('username') || `Anon${Math.floor(Math.random() * 10000)}`;
        console.log('🔐 [WebSocket] Sending auth:', username);
        sendJsonMessage({ type: 'auth', username, role: 'viewer' });

        // Send join immediately (server processes in order)
        console.log('🚪 [WebSocket] Joining room:', roomId);
        sendJsonMessage({ type: 'join_stream', roomId });
      },
      onMessage: (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 [WebSocket] Received:', data.type);

        switch (data.type) {
          case 'join_stream_response':
            if (data.success && data.stream) {
              console.log('✅ [Stream] Joined:', data.stream.title);
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
            setTerminalBuffer(prev => {
              const MAX_BUFFER = 100000;
              const updated = prev + data.data;
              return updated.length > MAX_BUFFER ? updated.slice(-MAX_BUFFER) : updated;
            });
            break;

          case 'chat':
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
            console.log('🛑 [Stream] Stream ended');
            navigate(`/chat/${roomId}`);
            break;
        }
      },
      onClose: () => {
        console.log('🔌 [WebSocket] Disconnected');
        setIsJoined(false);
      },
      shouldReconnect: () => true,
      reconnectAttempts: 10,
      reconnectInterval: (attemptNumber) =>
        Math.min(Math.pow(2, attemptNumber) * 1000, 30000),
    }
  );

  const isConnected = readyState === ReadyState.OPEN;

  const sendChat = (content: string, gifUrl?: string) => {
    if (!isJoined) {
      console.warn('[Chat] Cannot send - not joined');
      return false;
    }
    sendJsonMessage({ type: 'send_chat', content, gifUrl });
    return true;
  };

  return (
    <div className="watch-page">
      {/* Stream header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gh-text-primary flex items-center gap-2">
              {streamInfo?.title || initialTitle || 'Loading...'}
              {isConnected && (
                <span className="px-2 py-1 rounded bg-gh-accent-red text-white text-xs font-bold flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </span>
              )}
            </h1>
            <div className="text-sm text-gh-text-secondary mt-1">
              {streamInfo?.broadcaster || 'Unknown broadcaster'} •{' '}
              {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Connection status */}
          <div className="text-sm">
            {!isConnected && (
              <span className="text-gh-accent-orange">Connecting...</span>
            )}
            {isConnected && !isJoined && (
              <span className="text-gh-accent-blue">Joining stream...</span>
            )}
            {isConnected && isJoined && (
              <span className="text-gh-accent-green">● Connected</span>
            )}
          </div>
        </div>
      </div>

      {/* Main content: Terminal + Chat */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)] lg:h-[calc(100vh-8rem)]">
        {/* Terminal */}
        <div className="flex-1 lg:flex-[2] bg-black rounded-lg border border-gh-border overflow-hidden min-h-[40vh] sm:min-h-[50vh] lg:min-h-0">
          <Terminal data={terminalBuffer} />
        </div>

        {/* Chat */}
        <div className="h-64 sm:h-80 lg:h-auto lg:flex-1">
          <ChatBox
            roomId={roomId}
            onSendMessage={sendChat}
            disabled={!isJoined}
          />
        </div>
      </div>
    </div>
  );
}
