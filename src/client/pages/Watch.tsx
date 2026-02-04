import { useParams, useNavigate } from 'react-router-dom';
import { Terminal } from '../components/terminal/Terminal';
import { ChatBox } from '../components/chat/ChatBox';
import { useTerminal } from '../hooks/useTerminal';

export default function Watch() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  if (!roomId) {
    return <div>Invalid room ID</div>;
  }

  const { isConnected, isJoined, terminalBuffer, viewerCount, streamInfo, sendChat } = useTerminal({
    roomId,
    onStreamEnd: () => {
      // Navigate to chat archive when stream ends
      navigate(`/chat/${roomId}`);
    },
  });

  return (
    <div className="watch-page h-[calc(100vh-8rem)]">
      {/* Stream header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gh-text-primary flex items-center gap-2">
              {streamInfo?.title || 'Loading...'}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Terminal (2/3 width on desktop) */}
        <div className="lg:col-span-2 bg-black rounded-lg border border-gh-border overflow-hidden">
          <Terminal data={terminalBuffer} />
        </div>

        {/* Chat (1/3 width on desktop) */}
        <div className="lg:col-span-1">
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
