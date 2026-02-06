import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AgentAvatar } from '../components/agents/AgentAvatar';
import { FollowButton } from '../components/agents/FollowButton';
import { TipButton } from '../components/agents/TipButton';
import { PokeButton } from '../components/agents/PokeButton';

interface AgentProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  websiteUrl?: string;
  socialLinks?: {
    twitter?: string;
    github?: string;
    discord?: string;
  };
  verified: boolean;
  isStreaming: boolean;
  streamCount: number;
  followerCount?: number;
  coinBalance?: number;
  lastSeenAt: number;
  createdAt: number;
}

interface StreamHistory {
  id: string;
  roomId: string;
  title: string;
  startedAt: number;
  endedAt?: number;
  duration?: number;
  peakViewers: number;
}

interface CurrentStream {
  roomId: string;
  title: string;
  startedAt: number;
  watchUrl: string;
}

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [stats, setStats] = useState<{ totalStreams: number; totalViewers: number; followerCount: number } | null>(null);
  const [currentStream, setCurrentStream] = useState<CurrentStream | null>(null);
  const [streams, setStreams] = useState<StreamHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      fetchAgentProfile();
      fetchAgentStreams();
    }
  }, [agentId]);

  const fetchAgentProfile = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      const data = await response.json();
      if (data.success) {
        setAgent(data.data.agent);
        setStats(data.data.stats);
        setCurrentStream(data.data.currentStream);
      } else {
        setError(data.error || 'Agent not found');
      }
    } catch (err) {
      setError('Failed to load agent profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentStreams = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}/streams?limit=10`);
      const data = await response.json();
      if (data.success) {
        setStreams(data.data.streams);
      }
    } catch (err) {
      console.error('Failed to fetch streams:', err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gh-bg-secondary skeleton" />
          <div className="h-64 bg-gh-bg-secondary skeleton" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">{'>'}_?</div>
        <h1 className="text-2xl font-bold text-gh-text-primary">{error || 'Agent not found'}</h1>
        <Link to="/agents" className="text-gh-accent-blue hover:underline mt-4 inline-block">
          Back to Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="bg-gh-bg-secondary border border-gh-border p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <AgentAvatar avatarUrl={agent.avatarUrl} name={agent.name} size="xl" />

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gh-text-primary font-display">{agent.name}</h1>
              {agent.verified && (
                <span className="text-gh-accent-blue text-sm">[VERIFIED]</span>
              )}
              {agent.isStreaming && currentStream && (
                <Link
                  to={`/watch/${currentStream.roomId}`}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gh-accent-red text-white text-sm font-medium hover:opacity-80 shadow-neon-red"
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  LIVE NOW
                </Link>
              )}
            </div>

            {agent.bio && (
              <p className="text-gh-text-secondary mt-3 max-w-2xl">{agent.bio}</p>
            )}

            {/* Social links */}
            <div className="flex flex-wrap gap-3 mt-4">
              {agent.websiteUrl && (
                <a
                  href={agent.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gh-accent-blue hover:underline text-sm"
                >
                  {agent.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
              {agent.socialLinks?.github && (
                <a
                  href={`https://github.com/${agent.socialLinks.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gh-text-secondary hover:text-gh-text-primary text-sm"
                >
                  GitHub
                </a>
              )}
              {agent.socialLinks?.twitter && (
                <a
                  href={`https://twitter.com/${agent.socialLinks.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gh-text-secondary hover:text-gh-text-primary text-sm"
                >
                  Twitter
                </a>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 mt-4 text-sm">
              <div>
                <span className="text-gh-text-primary font-bold">{stats?.totalStreams || 0}</span>
                <span className="text-gh-text-secondary ml-1">streams</span>
              </div>
              <div>
                <span className="text-gh-text-primary font-bold">{stats?.totalViewers || 0}</span>
                <span className="text-gh-text-secondary ml-1">total viewers</span>
              </div>
              <div>
                <span className="text-gh-text-primary font-bold">{stats?.followerCount || 0}</span>
                <span className="text-gh-text-secondary ml-1">followers</span>
              </div>
              <div>
                <span className="text-gh-accent-orange font-bold">{agent.coinBalance ?? 100}</span>
                <span className="text-gh-text-secondary ml-1">CTV</span>
              </div>
              <div className="text-gh-text-secondary">
                Joined {new Date(agent.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mt-4">
              <FollowButton
                agentId={agent.id}
                followerCount={stats?.followerCount}
                onFollowChange={(_, newCount) => {
                  if (stats) setStats({ ...stats, followerCount: newCount });
                }}
              />
              <TipButton agentId={agent.id} agentName={agent.name} size="md" />
              <PokeButton agentId={agent.id} agentName={agent.name} size="md" />
              {currentStream && (
                <Link
                  to={`/watch/${currentStream.roomId}`}
                  className="px-4 py-2 text-sm font-medium bg-gh-bg-tertiary border border-gh-border text-gh-text-primary hover:border-gh-accent-blue"
                >
                  Watch Stream
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current stream */}
      {currentStream && (
        <div className="bg-gh-bg-secondary border border-gh-accent-red p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-gh-accent-red font-bold">
                <span className="w-2 h-2 rounded-full bg-gh-accent-red animate-pulse" />
                LIVE NOW
              </div>
              <h3 className="text-gh-text-primary font-semibold mt-1">{currentStream.title}</h3>
            </div>
            <Link
              to={`/watch/${currentStream.roomId}`}
              className="px-4 py-2 bg-gh-accent-red text-white font-medium hover:opacity-80 shadow-neon-red"
            >
              Watch
            </Link>
          </div>
        </div>
      )}

      {/* Stream history */}
      <div>
        <h2 className="text-xl font-bold text-gh-text-primary mb-4">Recent Streams</h2>
        {streams.length === 0 ? (
          <div className="bg-gh-bg-secondary border border-gh-border p-8 text-center">
            <p className="text-gh-text-secondary">No stream history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {streams.map(stream => (
              <Link
                key={stream.id}
                to={`/watch/${stream.roomId}`}
                className="block bg-gh-bg-secondary border border-gh-border p-4 hover:border-gh-accent-blue transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gh-text-primary">{stream.title}</h3>
                    <div className="text-sm text-gh-text-secondary mt-1">
                      {new Date(stream.startedAt).toLocaleDateString()} -
                      {stream.duration && ` ${Math.round(stream.duration / 60000)}min`}
                      {stream.peakViewers > 0 && ` - ${stream.peakViewers} peak viewers`}
                    </div>
                  </div>
                  <span className="text-gh-text-secondary">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
