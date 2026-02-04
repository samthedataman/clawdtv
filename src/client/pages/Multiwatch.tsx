import { useEffect, useState } from 'react';
import { Terminal } from '../components/terminal/Terminal';
import { useTerminal } from '../hooks/useTerminal';
import { useStreamStore } from '../store/streamStore';

export default function Multiwatch() {
  const { streams, fetchStreams } = useStreamStore();
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [gridLayout, setGridLayout] = useState<number>(2); // 1, 2, 4, 6, 9

  useEffect(() => {
    fetchStreams();
  }, []);

  const toggleStream = (roomId: string) => {
    setSelectedStreams(prev => {
      if (prev.includes(roomId)) {
        return prev.filter(id => id !== roomId);
      } else {
        // Limit based on grid layout
        const maxStreams = gridLayout;
        if (prev.length >= maxStreams) {
          return [...prev.slice(1), roomId]; // Remove first, add new
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
          <h1 className="text-2xl font-bold text-gh-text-primary">Multi-Watch</h1>
          <p className="text-sm text-gh-text-secondary mt-1">
            {selectedStreams.length} / {gridLayout} streams selected
          </p>
        </div>

        {/* Grid layout buttons */}
        <div className="flex gap-2">
          {[1, 2, 4, 6, 9].map((layout) => (
            <button
              key={layout}
              onClick={() => {
                setGridLayout(layout);
                // Trim selected streams if needed
                if (selectedStreams.length > layout) {
                  setSelectedStreams(prev => prev.slice(0, layout));
                }
              }}
              className={`px-3 py-2 rounded-md font-medium transition-colors ${
                gridLayout === layout
                  ? 'bg-gh-accent-blue text-white'
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
          <h3 className="font-semibold text-gh-text-primary mb-3">Available Streams</h3>
          <div className="flex flex-wrap gap-2">
            {streams.map((stream) => (
              <button
                key={stream.id}
                onClick={() => toggleStream(stream.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedStreams.includes(stream.id)
                    ? 'bg-gh-accent-blue text-white'
                    : 'bg-gh-bg-tertiary text-gh-text-primary border border-gh-border hover:bg-gh-bg-primary'
                }`}
              >
                {stream.ownerUsername} • {stream.viewerCount} viewers
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid of terminals */}
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
    </div>
  );
}

function StreamPanel({ roomId, onRemove }: { roomId: string; onRemove: () => void }) {
  const { isJoined, terminalBuffer, streamInfo, viewerCount } = useTerminal({ roomId });

  return (
    <div className="stream-panel bg-black rounded-lg border border-gh-border overflow-hidden relative group">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-sm p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-xs text-white">
          <div className="font-semibold">{streamInfo?.title || 'Loading...'}</div>
          <div className="text-gray-400">{viewerCount} viewers</div>
        </div>
        <button
          onClick={onRemove}
          className="px-2 py-1 rounded bg-gh-accent-red text-white text-xs hover:bg-red-600"
        >
          ✕
        </button>
      </div>

      {/* Terminal */}
      <div className="h-96">
        <Terminal data={terminalBuffer} />
      </div>

      {/* Status indicator */}
      {!isJoined && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-sm">Connecting...</div>
        </div>
      )}
    </div>
  );
}
