import { useEffect, useState } from 'react';
import { Terminal } from '../components/terminal/Terminal';
import { ChatBox } from '../components/chat/ChatBox';
import { useTerminal } from '../hooks/useTerminal';
import { useStreamStore } from '../store/streamStore';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Multiwatch() {
  const { streams, fetchStreams } = useStreamStore();
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [gridLayout, setGridLayout] = useState<number>(2);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchStreams();
  }, []);

  const toggleStream = (roomId: string) => {
    setSelectedStreams(prev => {
      if (prev.includes(roomId)) {
        return prev.filter(id => id !== roomId);
      } else {
        const maxStreams = isMobile ? 99 : gridLayout;
        if (!isMobile && prev.length >= maxStreams) {
          return [...prev.slice(1), roomId];
        }
        return [...prev, roomId];
      }
    });
  };

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    4: 'grid-cols-2 md:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3',
    9: 'grid-cols-3',
  }[gridLayout];

  return (
    <div className="multiwatch-page space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between bg-gh-bg-secondary rounded-lg border border-gh-border p-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gh-text-primary">Multi-Watch</h1>
          <p className="text-sm text-gh-text-secondary mt-1">
            {selectedStreams.length} stream{selectedStreams.length !== 1 ? 's' : ''} active
          </p>
        </div>

        {/* Grid layout buttons - desktop only */}
        <div className="hidden md:flex gap-2">
          {[1, 2, 4, 6, 9].map((layout) => (
            <button
              key={layout}
              onClick={() => {
                setGridLayout(layout);
                if (selectedStreams.length > layout) {
                  setSelectedStreams(prev => prev.slice(0, layout));
                }
              }}
              className={`px-3 py-2 rounded-md font-medium transition-colors ${
                gridLayout === layout
                  ? 'bg-gh-accent-blue text-gh-bg-primary shadow-neon-cyan-sm'
                  : 'bg-gh-bg-tertiary text-gh-text-primary border border-gh-border hover:bg-gh-bg-primary'
              }`}
            >
              {layout}
            </button>
          ))}
        </div>
      </div>

      {/* Stream selector */}
      {streams.length > 0 && (
        <div className="bg-gh-bg-secondary rounded-lg border border-gh-border p-4">
          <h3 className="font-semibold text-gh-text-primary mb-3">
            Available Streams
            {streams.length > 12 && (
              <span className="text-xs text-gh-text-secondary font-normal ml-2">
                (showing top 12 of {streams.length})
              </span>
            )}
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...streams]
              .sort((a, b) => b.viewerCount - a.viewerCount)
              .slice(0, 12)
              .map((stream) => (
              <button
                key={stream.id}
                onClick={() => toggleStream(stream.id)}
                className={`px-4 py-2 sm:px-3 sm:py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                  selectedStreams.includes(stream.id)
                    ? 'bg-gh-accent-blue text-gh-bg-primary shadow-neon-cyan-sm'
                    : 'bg-gh-bg-tertiary text-gh-text-primary border border-gh-border hover:bg-gh-bg-primary'
                }`}
              >
                {stream.ownerUsername} • {stream.viewerCount}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MOBILE: Vertical scroll */}
      {isMobile ? (
        <div className="space-y-4">
          {selectedStreams.map((roomId, index) => (
            <MobileStreamPanel
              key={roomId}
              roomId={roomId}
              index={index}
              total={selectedStreams.length}
              onRemove={() => toggleStream(roomId)}
            />
          ))}
          {selectedStreams.length === 0 && (
            <div className="bg-gh-bg-secondary rounded-lg border border-dashed border-gh-border flex items-center justify-center min-h-64 text-gh-text-secondary">
              Select a stream to watch
            </div>
          )}
        </div>
      ) : (
        /* DESKTOP: Grid layout */
        <div className={`grid ${gridCols} gap-4`}>
          {selectedStreams.map((roomId) => (
            <StreamPanel key={roomId} roomId={roomId} onRemove={() => toggleStream(roomId)} />
          ))}

          {/* Empty slots */}
          {[...Array(gridLayout - selectedStreams.length)].map((_, i) => (
            <div
              key={`empty-${i}`}
              className="bg-gh-bg-secondary rounded-lg border border-dashed border-gh-border flex items-center justify-center min-h-64 text-gh-text-secondary"
            >
              Select a stream
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Mobile stream panel with integrated chat
function MobileStreamPanel({
  roomId,
  index,
  total,
  onRemove,
}: {
  roomId: string;
  index: number;
  total: number;
  onRemove: () => void;
}) {
  const { isJoined, terminalBuffer, streamInfo, viewerCount, sendChat } = useTerminal({ roomId });
  const [chatExpanded, setChatExpanded] = useState(false);

  return (
    <div className="mobile-stream-panel bg-gh-bg-primary rounded-lg border border-gh-border overflow-hidden">
      {/* Header - stream info + position indicator */}
      <div className="sticky top-16 z-20 bg-gh-bg-primary/90 backdrop-blur-sm p-3 border-b border-gh-border">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gh-text-primary text-sm truncate">
              {streamInfo?.title || 'Loading...'}
            </h3>
            <p className="text-xs text-gh-text-secondary">
              {viewerCount} viewers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Position indicator */}
            <span className="text-xs text-gh-text-secondary px-2 py-1 bg-gh-bg-tertiary rounded-md">
              {index + 1}/{total}
            </span>
            {/* Remove button */}
            <button
              onClick={onRemove}
              className="px-2 py-1 rounded bg-gh-accent-red text-white text-xs hover:opacity-80 hover:shadow-neon-red min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Remove stream"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Terminal - dynamic height based on chat state */}
      <div
        className="terminal-wrapper transition-all duration-300"
        style={{
          height: chatExpanded ? '50vh' : 'calc(100vh - 20rem)',
        }}
      >
        <Terminal data={terminalBuffer} />
      </div>

      {/* Chat - expandable */}
      <div
        className={`chat-wrapper transition-all duration-300 border-t border-gh-border ${
          chatExpanded ? 'h-80' : 'h-48'
        }`}
      >
        <div className="flex items-center justify-between p-2 bg-gh-bg-tertiary border-b border-gh-border">
          <span className="text-sm font-medium text-gh-text-primary">Chat</span>
          <button
            onClick={() => setChatExpanded(!chatExpanded)}
            className="p-2 rounded hover:bg-gh-bg-primary text-gh-text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={chatExpanded ? 'Collapse chat' : 'Expand chat'}
          >
            {chatExpanded ? '↓' : '↑'}
          </button>
        </div>
        <ChatBox roomId={roomId} onSendMessage={sendChat} disabled={!isJoined} />
      </div>

      {/* Status indicator */}
      {!isJoined && (
        <div className="absolute inset-0 flex items-center justify-center bg-gh-bg-primary/50 z-30">
          <div className="text-gh-text-primary text-sm">Connecting...</div>
        </div>
      )}
    </div>
  );
}

// Desktop stream panel
function StreamPanel({ roomId, onRemove }: { roomId: string; onRemove: () => void }) {
  const { isJoined, terminalBuffer, streamInfo, viewerCount, sendChat } = useTerminal({ roomId });

  return (
    <div className="stream-panel bg-gh-bg-primary rounded-lg border border-gh-border overflow-hidden relative group">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gh-bg-primary/80 backdrop-blur-sm p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-xs text-gh-text-primary">
          <div className="font-semibold">{streamInfo?.title || 'Loading...'}</div>
          <div className="text-gh-text-secondary">{viewerCount} viewers</div>
        </div>
        <button
          onClick={onRemove}
          className="px-2 py-1 rounded bg-gh-accent-red text-white text-xs hover:opacity-80 hover:shadow-neon-red"
        >
          ✕
        </button>
      </div>

      {/* Terminal - responsive height */}
      <div className="h-64 sm:h-80 md:h-96">
        <Terminal data={terminalBuffer} />
      </div>

      {/* Status indicator */}
      {!isJoined && (
        <div className="absolute inset-0 flex items-center justify-center bg-gh-bg-primary/50">
          <div className="text-gh-text-primary text-sm">Connecting...</div>
        </div>
      )}
    </div>
  );
}
