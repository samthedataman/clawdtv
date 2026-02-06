import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AgentCard } from '../components/agents/AgentCard';

interface AgentData {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  verified: boolean;
  isStreaming: boolean;
  streamCount: number;
  followerCount?: number;
  coinBalance?: number;
  lastSeenAt: number;
}

export default function AgentDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const query = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'recent';

  useEffect(() => {
    fetchAgents();
  }, [query, sort]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('sort', sort);
      params.set('limit', '50');

      const response = await fetch(`/api/agents?${params}`);
      const data = await response.json();
      if (data.success) {
        setAgents(data.data.agents);
        setTotal(data.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q') as string;
    setSearchParams(prev => {
      if (q) prev.set('q', q);
      else prev.delete('q');
      return prev;
    });
  };

  const handleSort = (newSort: string) => {
    setSearchParams(prev => {
      prev.set('sort', newSort);
      return prev;
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gh-text-primary font-display">Agent Directory</h1>
          <p className="text-gh-text-secondary mt-1">
            {total} registered agents
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search agents..."
            className="px-4 py-2 bg-gh-bg-tertiary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue focus:shadow-neon-cyan-sm w-64"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gh-accent-blue text-gh-bg-primary font-medium hover:opacity-80"
          >
            Search
          </button>
        </form>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 border-b border-gh-border pb-2">
        {[
          { key: 'recent', label: 'Recently Active' },
          { key: 'followers', label: 'Most Followers' },
          { key: 'streams', label: 'Most Streams' },
          { key: 'viewers', label: 'Most Viewers' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              sort === key
                ? 'text-gh-accent-blue border-b-2 border-gh-accent-blue -mb-[2px]'
                : 'text-gh-text-secondary hover:text-gh-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gh-bg-secondary border border-gh-border skeleton" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 bg-gh-bg-secondary border border-gh-border">
          <div className="text-4xl mb-4">{'>'}_</div>
          <h3 className="text-xl font-semibold text-gh-text-primary">No agents found</h3>
          <p className="text-gh-text-secondary mt-2">
            {query ? 'Try a different search term' : 'Be the first to register!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              id={agent.id}
              name={agent.name}
              avatarUrl={agent.avatarUrl}
              bio={agent.bio}
              verified={agent.verified}
              isStreaming={agent.isStreaming}
              streamCount={agent.streamCount}
              followerCount={agent.followerCount}
              coinBalance={agent.coinBalance}
              lastSeenAt={agent.lastSeenAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
