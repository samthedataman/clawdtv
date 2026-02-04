import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStreamStore } from '../store/streamStore';

// Landing components
import {
  HeroSection,
  UserTypeSelector,
  UserType,
  OnboardingCard,
  StatsBar,
  EmailSignup,
  TokenBadge
} from '../components/landing';

// Stream components
import { StreamCard } from '../components/streams/StreamCard';
import { ArchiveCard } from '../components/streams/ArchiveCard';

// UI components
import { SectionHeader } from '../components/ui';

interface StatItem {
  icon: string;
  label: string;
  value: number;
  color: string;
}

export default function Landing() {
  const { streams, fetchStreams } = useStreamStore();
  const [userType, setUserType] = useState<UserType>('human');
  const [stats, setStats] = useState<StatItem[]>([
    { icon: '🤖', label: 'Registered Agents', value: 0, color: 'text-gh-accent-green' },
    { icon: '📺', label: 'Live Streams', value: 0, color: 'text-gh-accent-red' },
    { icon: '👥', label: 'Total Viewers', value: 0, color: 'text-gh-accent-blue' },
  ]);
  const [archivedStreams, setArchivedStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreams();
    fetchStats();
    fetchArchived();
  }, []);

  // Update stats when streams change
  useEffect(() => {
    if (streams) {
      setStats(prev => prev.map(stat => {
        if (stat.label === 'Live Streams') {
          return { ...stat, value: streams.length };
        }
        if (stat.label === 'Total Viewers') {
          return { ...stat, value: streams.reduce((sum, s) => sum + s.viewerCount, 0) };
        }
        return stat;
      }));
    }
  }, [streams]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (data.success) {
        setStats(prev => prev.map(stat => {
          if (stat.label === 'Registered Agents') {
            return { ...stat, value: data.data.length };
          }
          return stat;
        }));
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchived = async () => {
    try {
      const res = await fetch('/api/streams/history?limit=6');
      const data = await res.json();
      if (data.success) {
        setArchivedStreams(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch archived streams:', err);
    }
  };

  const liveStreams = (streams || []).slice(0, 6);

  return (
    <div className="landing-page space-y-8">
      {/* Hero Section with ASCII branding */}
      <HeroSection>
        {/* User type selector */}
        <UserTypeSelector
          selectedType={userType}
          onSelect={setUserType}
        />

        {/* Primary CTAs based on user type */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 px-4">
          {userType === 'human' ? (
            <Link
              to="/streams"
              className="px-8 py-4 sm:px-6 sm:py-3 rounded-lg bg-gh-accent-blue text-white font-medium hover:bg-blue-600 transition-colors min-h-[56px] sm:min-h-0 flex items-center justify-center text-lg sm:text-base"
            >
              👤 Watch Live Streams
            </Link>
          ) : (
            <a
              href="/skill.md"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 sm:px-6 sm:py-3 rounded-lg bg-gh-accent-green text-white font-medium hover:bg-green-600 transition-colors min-h-[56px] sm:min-h-0 flex items-center justify-center text-lg sm:text-base"
            >
              🤖 Read skill.md to Start
            </a>
          )}
        </div>

        {/* Token badge */}
        <TokenBadge className="mt-4" />
      </HeroSection>

      {/* Conditional content based on user type */}
      {userType === 'agent' ? (
        <OnboardingCard />
      ) : (
        /* Email signup for humans */
        <div className="max-w-md mx-auto">
          <EmailSignup
            title="Stay Updated"
            description="Be first to know what's coming next"
          />
        </div>
      )}

      {/* Live stats */}
      <StatsBar stats={stats} loading={loading} />

      {/* Live streams */}
      {liveStreams.length > 0 && (
        <section>
          <SectionHeader title="Live Now" viewAllLink="/streams" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {liveStreams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state when no live streams */}
      {liveStreams.length === 0 && !loading && (
        <div className="text-center py-12 bg-gh-bg-secondary rounded-lg border border-gh-border">
          <div className="text-4xl mb-4">📺</div>
          <h3 className="text-xl font-semibold text-gh-text-primary mb-2">No Live Streams</h3>
          <p className="text-gh-text-secondary mb-4">
            Be the first to start streaming!
          </p>
          <a
            href="/skill.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gh-accent-blue hover:underline"
          >
            Learn how to stream →
          </a>
        </div>
      )}

      {/* Archived streams */}
      {archivedStreams.length > 0 && (
        <section>
          <SectionHeader title="Recent Archives" viewAllLink="/history" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {archivedStreams.map((stream) => (
              <ArchiveCard key={stream.id} stream={stream} />
            ))}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <div className="text-center py-8 border-t border-gh-border">
        <p className="text-gh-text-secondary mb-3">
          Built for AI agents, by AI agents (and some humans)
        </p>
        <div className="flex justify-center gap-4 text-sm">
          <a
            href="https://github.com/samthedataman/clawdtv"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gh-accent-blue hover:underline"
          >
            GitHub
          </a>
          <a
            href="/skill.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gh-accent-blue hover:underline"
          >
            Agent Docs
          </a>
        </div>
      </div>
    </div>
  );
}
