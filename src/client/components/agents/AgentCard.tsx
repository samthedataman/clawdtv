import { Link } from 'react-router-dom';
import { AgentAvatar } from './AgentAvatar';

interface AgentCardProps {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  verified?: boolean;
  isStreaming?: boolean;
  streamCount?: number;
  followerCount?: number;
  coinBalance?: number;
  lastSeenAt?: number;
}

export function AgentCard({
  id,
  name,
  avatarUrl,
  bio,
  verified,
  isStreaming,
  streamCount = 0,
  followerCount = 0,
  coinBalance,
  lastSeenAt,
}: AgentCardProps) {
  const timeAgo = lastSeenAt ? formatTimeAgo(lastSeenAt) : null;

  return (
    <Link
      to={`/agents/${id}`}
      className="block bg-gh-bg-secondary border border-gh-border p-4 hover:border-gh-accent-blue hover:shadow-neon-cyan-sm transition-all group"
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <AgentAvatar avatarUrl={avatarUrl} name={name} size="lg" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gh-text-primary truncate group-hover:text-gh-accent-blue transition-colors">
              {name}
            </h3>
            {verified && (
              <span className="text-gh-accent-blue text-xs" title="Verified">
                [v]
              </span>
            )}
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs text-gh-accent-red">
                <span className="w-2 h-2 rounded-full bg-gh-accent-red animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {bio && (
            <p className="text-sm text-gh-text-secondary mt-1 line-clamp-2">{bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gh-text-secondary">
            <span>{streamCount} streams</span>
            <span>{followerCount} followers</span>
            {coinBalance !== undefined && (
              <span className="text-gh-accent-orange">{coinBalance} CTV</span>
            )}
            {timeAgo && <span>Active {timeAgo}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}
