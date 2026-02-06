import { useEffect, useState } from 'react';

interface DayStat {
  date: string;
  streamCount: number;
  uniqueAgents: number;
  totalViewers: number;
}

interface StreamingChartProps {
  days?: number;
  className?: string;
}

export function StreamingChart({ days = 14, className = '' }: StreamingChartProps) {
  const [stats, setStats] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'uniqueAgents' | 'streamCount' | 'totalViewers'>('uniqueAgents');

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/analytics/streaming?days=${days}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch streaming stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-gh-bg-secondary border border-gh-border p-4 ${className}`}>
        <div className="h-32 flex items-center justify-center">
          <span className="text-gh-text-secondary text-sm animate-pulse">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (stats.length === 0) {
    return null;
  }

  // Get values for selected metric
  const values = stats.map(s => s[metric]);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values);

  // Calculate totals
  const totalStreams = stats.reduce((sum, s) => sum + s.streamCount, 0);
  const avgAgents = Math.round(stats.reduce((sum, s) => sum + s.uniqueAgents, 0) / stats.length * 10) / 10;
  const totalViewers = stats.reduce((sum, s) => sum + s.totalViewers, 0);

  // SVG dimensions
  const width = 100;
  const height = 40;
  const padding = 2;

  // Generate path points
  const points = stats.map((_, i) => {
    const x = padding + (i / (stats.length - 1)) * (width - padding * 2);
    const y = height - padding - ((values[i] - minValue) / (maxValue - minValue || 1)) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  // Generate area path for fill
  const areaPath = `M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`;

  const metricColors = {
    uniqueAgents: { line: '#00ff41', fill: 'rgba(0, 255, 65, 0.15)', label: 'Agents/Day' },
    streamCount: { line: '#00ffff', fill: 'rgba(0, 255, 255, 0.15)', label: 'Streams/Day' },
    totalViewers: { line: '#bf5af2', fill: 'rgba(191, 90, 242, 0.15)', label: 'Viewers/Day' },
  };

  const color = metricColors[metric];

  return (
    <div className={`bg-gh-bg-secondary border border-gh-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gh-border">
        <h3 className="text-xs font-bold text-gh-text-primary uppercase tracking-wider flex items-center gap-2">
          <span className="text-gh-accent-cyan">{'>'}</span>
          STREAMING ACTIVITY
        </h3>
        <span className="text-xs text-gh-text-secondary">{days}d</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-gh-border/50">
        <button
          onClick={() => setMetric('uniqueAgents')}
          className={`text-center p-2 transition-colors ${metric === 'uniqueAgents' ? 'bg-gh-accent-green/10 border border-gh-accent-green/30' : 'hover:bg-gh-bg-tertiary border border-transparent'}`}
        >
          <div className="text-lg font-bold text-gh-accent-green font-mono">{avgAgents}</div>
          <div className="text-[10px] text-gh-text-secondary uppercase">Avg Agents</div>
        </button>
        <button
          onClick={() => setMetric('streamCount')}
          className={`text-center p-2 transition-colors ${metric === 'streamCount' ? 'bg-gh-accent-cyan/10 border border-gh-accent-cyan/30' : 'hover:bg-gh-bg-tertiary border border-transparent'}`}
        >
          <div className="text-lg font-bold text-gh-accent-cyan font-mono">{totalStreams}</div>
          <div className="text-[10px] text-gh-text-secondary uppercase">Total Streams</div>
        </button>
        <button
          onClick={() => setMetric('totalViewers')}
          className={`text-center p-2 transition-colors ${metric === 'totalViewers' ? 'bg-gh-accent-purple/10 border border-gh-accent-purple/30' : 'hover:bg-gh-bg-tertiary border border-transparent'}`}
        >
          <div className="text-lg font-bold text-gh-accent-purple font-mono">{totalViewers}</div>
          <div className="text-[10px] text-gh-text-secondary uppercase">Peak Views</div>
        </button>
      </div>

      {/* Chart */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gh-text-secondary uppercase">{color.label}</span>
          <span className="text-[10px] text-gh-text-secondary">max: {maxValue}</span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-16"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

          {/* Area fill */}
          <path
            d={areaPath}
            fill={color.fill}
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={color.line}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {stats.map((_, i) => {
            const x = padding + (i / (stats.length - 1)) * (width - padding * 2);
            const y = height - padding - ((values[i] - minValue) / (maxValue - minValue || 1)) * (height - padding * 2);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.5"
                fill={color.line}
                className="opacity-50"
              />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 text-[8px] text-gh-text-secondary">
          <span>{new Date(stats[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>{new Date(stats[stats.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
}
