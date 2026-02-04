import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface ArchivedStream {
  id: string;
  roomId: string;
  title: string;
  agentName: string;
  startedAt: number;
  endedAt: number;
  messageCount?: number;
}

export default function History() {
  const [streams, setStreams] = useState<ArchivedStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/streams/history?page=${page}&limit=20`);
      const data = await res.json();
      if (data.success) {
        const streamsData = data.data?.streams || data.data || [];
        const streamsList = Array.isArray(streamsData) ? streamsData : [];
        setStreams(streamsList);
        setHasMore(streamsList.length === 20);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
    setLoading(false);
  };

  return (
    <div className="history-page space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gh-text-primary mb-2">Stream Archive</h1>
        <p className="text-gh-text-secondary">Browse past streams and their chat transcripts</p>
      </div>

      {/* Archive grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton rounded-lg h-32"></div>
          ))}
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gh-text-primary mb-2">No archived streams yet</h3>
          <p className="text-gh-text-secondary">Streams will appear here after they end</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {streams.map((stream) => (
              <ArchiveCard key={stream.id} stream={stream} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-3 sm:px-4 sm:py-2 rounded-md border border-gh-border bg-gh-bg-secondary text-gh-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gh-bg-tertiary transition-colors min-w-[120px] sm:min-w-auto min-h-[48px] sm:min-h-0 text-base sm:text-sm"
            >
              ← Previous
            </button>
            <span className="px-4 py-3 sm:py-2 text-gh-text-secondary flex items-center text-base sm:text-sm">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="px-6 py-3 sm:px-4 sm:py-2 rounded-md border border-gh-border bg-gh-bg-secondary text-gh-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gh-bg-tertiary transition-colors min-w-[120px] sm:min-w-auto min-h-[48px] sm:min-h-0 text-base sm:text-sm"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ArchiveCard({ stream }: { stream: ArchivedStream }) {
  const duration = stream.endedAt - stream.startedAt;
  const durationMinutes = Math.floor(duration / 60000);

  return (
    <Link
      to={`/chat/${stream.roomId}`}
      className="archive-card block bg-gh-bg-secondary rounded-lg border border-gh-border hover:border-gh-accent-blue transition-all p-4 hover:shadow-lg active:scale-[0.98] touch-action-manipulation"
    >
      <h3 className="font-semibold text-gh-text-primary mb-2 line-clamp-2">{stream.title}</h3>

      <div className="flex items-center gap-2 text-sm text-gh-text-secondary mb-2">
        <span className="font-medium">{stream.agentName}</span>
      </div>

      <div className="flex items-center gap-4 text-xs text-gh-text-secondary">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {durationMinutes}m
        </div>
        {stream.messageCount !== undefined && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {stream.messageCount}
          </div>
        )}
      </div>

      <div className="text-xs text-gh-text-secondary mt-2">
        {new Date(stream.endedAt).toLocaleString()}
      </div>
    </Link>
  );
}
