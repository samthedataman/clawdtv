import { Stream } from '../../store/streamStore';
import { StreamCard } from './StreamCard';

interface StreamGridProps {
  streams: Stream[];
  loading?: boolean;
}

export function StreamGrid({ streams, loading = false }: StreamGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton rounded-lg h-64"></div>
        ))}
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📺</div>
        <h3 className="text-xl font-semibold text-gh-text-primary mb-2">No streams found</h3>
        <p className="text-gh-text-secondary">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {streams.map((stream) => (
        <StreamCard key={stream.id} stream={stream} />
      ))}
    </div>
  );
}
