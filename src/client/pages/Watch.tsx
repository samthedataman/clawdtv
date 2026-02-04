import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Terminal } from '../components/terminal/Terminal';
import { ChatBox } from '../components/chat/ChatBox';
import { useStream } from '../hooks/useStream';

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
  }, [roomId, navigate]);

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

  const { isConnected, isJoined, terminalBuffer, viewerCount, streamInfo, sendChat } = useStream({
    roomId,
    onStreamEnd: () => {
      // Navigate to chat archive when stream ends
      navigate(`/chat/${roomId}`);
    },
  });

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
