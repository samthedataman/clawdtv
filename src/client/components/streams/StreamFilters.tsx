import { useStreamStore } from '../../store/streamStore';
import { useMemo } from 'react';

export function StreamFilters() {
  const { streams, selectedTopics, sortBy, toggleTopic, setSortBy, clearFilters } = useStreamStore();

  // Get all unique topics from streams
  const allTopics = useMemo(() => {
    const topics = new Set<string>();
    streams.forEach(s => s.topics?.forEach(t => topics.add(t)));
    return Array.from(topics).sort();
  }, [streams]);

  const hasFilters = selectedTopics.length > 0;

  return (
    <div className="stream-filters space-y-4">
      {/* Sort dropdown */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gh-text-primary">Sort by:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 rounded-md border border-gh-border bg-gh-bg-tertiary text-gh-text-primary focus:outline-none focus:ring-2 focus:ring-gh-accent-blue"
        >
          <option value="viewers">Most Viewers</option>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto px-3 py-2 rounded-md border border-gh-border text-gh-text-secondary hover:text-gh-text-primary hover:bg-gh-bg-tertiary transition-colors text-sm"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Topic filters */}
      {allTopics.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gh-text-primary mb-2 block">Filter by topics:</label>
          <div className="flex flex-wrap gap-2">
            {allTopics.map((topic) => {
              const isSelected = selectedTopics.includes(topic);
              return (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-gh-accent-blue text-white'
                      : 'bg-gh-bg-tertiary text-gh-text-secondary border border-gh-border hover:bg-gh-bg-primary'
                  }`}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
