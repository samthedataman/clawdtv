import { useEffect, useState } from 'react';
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
    4: 'grid-cols-2',
  }[gridLayout] || 'grid-cols-1 md:grid-cols-2';

  return (
    <div className="multiwatch-page h-full flex flex-col bg-[#0a0a0f]">
      {/* Controls */}
      <div className="shrink-0 flex items-center justify-between bg-[#0d0d14] border-b border-gh-border/50 p-4">
        <div>
          <h1 className="text-xl font-bold text-gh-text-primary flex items-center gap-2">
            <span className="text-gh-text-secondary">#</span>
            multi-chat
          </h1>
          <p className="text-sm text-gh-text-secondary mt-1">
            {selectedStreams.length} room{selectedStreams.length !== 1 ? 's' : ''} active
          </p>
        </div>

        {/* Grid layout buttons - desktop only */}
        <div className="hidden md:flex gap-2">
          {[1, 2, 4].map((layout) => (
            <button
              key={layout}
              onClick={() => {
                setGridLayout(layout);
                if (selectedStreams.length > layout) {
                  setSelectedStreams(prev => prev.slice(0, layout));
                }
              }}
              className={`w-10 h-10 rounded flex items-center justify-center font-medium transition-colors ${
                gridLayout === layout
                  ? 'bg-gh-accent-blue text-gh-bg-primary'
                  : 'bg-[#1a1a2e] text-gh-text-primary border border-gh-border/30 hover:border-gh-accent-blue/50'
              }`}
            >
              {layout}
            </button>
          ))}
        </div>
      </div>

      {/* Stream selector */}
      {streams.length > 0 && (
        <div className="shrink-0 bg-[#0d0d14] border-b border-gh-border/50 px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gh-border/30">
            <span className="text-xs text-gh-text-secondary shrink-0 uppercase tracking-wider">Rooms:</span>
            {[...streams]
              .sort((a, b) => b.viewerCount - a.viewerCount)
              .slice(0, 12)
              .map((stream) => (
              <button
                key={stream.id}
                onClick={() => toggleStream(stream.id)}
                className={`shrink-0 px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedStreams.includes(stream.id)
                    ? 'bg-gh-accent-blue text-gh-bg-primary'
                    : 'bg-[#1a1a2e] text-gh-text-secondary hover:text-gh-text-primary border border-gh-border/30 hover:border-gh-accent-blue/30'
                }`}
              >
                <span className="text-gh-text-secondary/60 mr-1">#</span>
                {stream.ownerUsername}
                <span className="ml-2 text-xs opacity-60">{stream.viewerCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat rooms grid */}
      <div className={`flex-1 min-h-0 grid ${gridCols} gap-0.5 bg-gh-border/20 p-0.5`}>
        {selectedStreams.map((roomId) => (
          <ChatRoomPanel
            key={roomId}
            roomId={roomId}
            onRemove={() => toggleStream(roomId)}
          />
        ))}

        {/* Empty slots */}
        {[...Array(Math.max(0, gridLayout - selectedStreams.length))].map((_, i) => (
          <div
            key={`empty-${i}`}
            className="bg-[#0d0d14] flex flex-col items-center justify-center text-center p-8"
          >
            <div className="w-16 h-16 rounded-full bg-gh-border/20 flex items-center justify-center mb-4">
              <span className="text-3xl text-gh-text-secondary/40">#</span>
            </div>
            <p className="text-gh-text-secondary text-sm">Select a room above</p>
          </div>
        ))}
      </div>

      {/* No streams fallback */}
      {streams.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <div className="w-20 h-20 rounded-full bg-gh-border/20 flex items-center justify-center mb-4 mx-auto">
              <span className="text-4xl text-gh-text-secondary/40">#</span>
            </div>
            <h3 className="text-lg font-semibold text-gh-text-primary mb-2">No rooms available</h3>
            <p className="text-gh-text-secondary text-sm">Check back later or start your own!</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Chat room panel with full chat functionality
function ChatRoomPanel({ roomId, onRemove }: { roomId: string; onRemove: () => void }) {
  const { isJoined, streamInfo, viewerCount, sendChat } = useTerminal({ roomId });

  return (
    <div className="chat-room-panel bg-[#0d0d14] flex flex-col h-full relative group overflow-hidden">
      {/* Room header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-[#0a0a0f] border-b border-gh-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gh-text-secondary">#</span>
          <span className="font-semibold text-gh-text-primary text-sm truncate">
            {streamInfo?.title || 'Loading...'}
          </span>
          {isJoined && (
            <span className="flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-gh-accent-green" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gh-text-secondary">{viewerCount}</span>
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded flex items-center justify-center text-gh-text-secondary hover:text-gh-accent-red hover:bg-gh-accent-red/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Close room"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 min-h-0">
        <ChatBox
          roomId={roomId}
          roomTitle={streamInfo?.title || roomId}
          onSendMessage={sendChat}
          disabled={!isJoined}
          viewerCount={viewerCount}
        />
      </div>

      {/* Loading overlay */}
      {!isJoined && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]/80 z-10">
          <div className="flex items-center gap-2 text-gh-text-secondary text-sm">
            <div className="w-4 h-4 border-2 border-gh-accent-blue border-t-transparent rounded-full animate-spin" />
            <span>Connecting...</span>
          </div>
        </div>
      )}
    </div>
  );
}
