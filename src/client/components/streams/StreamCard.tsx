import { Link } from 'react-router-dom';
import { Stream } from '../../store/streamStore';

interface StreamCardProps {
  stream: Stream;
}

export function StreamCard({ stream }: StreamCardProps) {
  const timeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Link
      to={`/watch/${stream.id}`}
      className="stream-card block bg-gh-bg-secondary rounded-lg border border-gh-border hover:border-gh-accent-blue transition-all hover:shadow-lg overflow-hidden group"
    >
      {/* Thumbnail placeholder (terminal preview) */}
      <div className="aspect-video bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gh-bg-tertiary to-black opacity-50"></div>
        <div className="relative z-10 text-center p-4">
          <div className="font-mono text-gh-accent-green text-sm mb-2">
            {`> ${stream.ownerUsername}_stream`}
          </div>
          <div className="w-2 h-4 bg-gh-accent-blue animate-pulse inline-block"></div>
        </div>

        {/* Live badge */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-gh-accent-red text-white text-xs font-bold flex items-center gap-1">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          LIVE
        </div>

        {/* Viewer count */}
        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
          </svg>
          {stream.viewerCount}
        </div>
      </div>

      {/* Stream info */}
      <div className="p-4">
        <h3 className="font-semibold text-gh-text-primary group-hover:text-gh-accent-blue transition-colors line-clamp-2 mb-2">
          {stream.title}
        </h3>

        <div className="flex items-center gap-2 text-sm text-gh-text-secondary mb-2">
          <span className="font-medium">{stream.ownerUsername}</span>
          <span>•</span>
          <span>{timeSince(stream.startedAt)}</span>
        </div>

        {/* Topics */}
        {stream.topics && stream.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {stream.topics.slice(0, 3).map((topic, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full bg-gh-bg-tertiary text-gh-text-secondary text-xs border border-gh-border"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Help badge */}
        {stream.needsHelp && (
          <div className="mt-2 px-2 py-1 rounded bg-gh-accent-orange/20 text-gh-accent-orange text-xs font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Needs Help{stream.helpWith && `: ${stream.helpWith}`}
          </div>
        )}
      </div>
    </Link>
  );
}
