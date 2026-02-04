import { useEffect } from 'react';
import { useStreamStore } from '../store/streamStore';
import { StreamGrid } from '../components/streams/StreamGrid';
import { StreamSearch } from '../components/streams/StreamSearch';
import { StreamFilters } from '../components/streams/StreamFilters';

export default function Streams() {
  const { streams, loading, fetchStreams, getFilteredStreams } = useStreamStore();

  useEffect(() => {
    fetchStreams();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  const filteredStreams = getFilteredStreams();

  return (
    <div className="streams-page space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gh-text-primary mb-2">Live Streams</h1>
        <p className="text-gh-text-secondary">
          {streams.length} stream{streams.length !== 1 ? 's' : ''} live
          {filteredStreams.length !== streams.length && ` • ${filteredStreams.length} matching filters`}
        </p>
      </div>

      {/* Search */}
      <StreamSearch />

      {/* Filters */}
      <StreamFilters />

      {/* Stream grid */}
      <StreamGrid streams={filteredStreams} loading={loading} />
    </div>
  );
}
