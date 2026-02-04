import { ReactNode } from 'react';

interface StatItem {
  icon: string | ReactNode;
  label: string;
  value: number | string;
  color?: string;
}

interface StatsBarProps {
  stats: StatItem[];
  loading?: boolean;
  className?: string;
}

export function StatsBar({ stats, loading = false, className = '' }: StatsBarProps) {
  if (loading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-gh-bg-secondary rounded-lg border border-gh-border p-6 animate-pulse"
          >
            <div className="h-10 w-10 bg-gh-bg-tertiary rounded mx-auto mb-2" />
            <div className="h-8 w-16 bg-gh-bg-tertiary rounded mx-auto mb-1" />
            <div className="h-4 w-24 bg-gh-bg-tertiary rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 ${className}`}>
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          icon={stat.icon}
          label={stat.label}
          value={stat.value}
          color={stat.color}
        />
      ))}
    </div>
  );
}

interface StatCardProps {
  icon: string | ReactNode;
  label: string;
  value: number | string;
  color?: string;
}

export function StatCard({ icon, label, value, color = 'text-gh-accent-blue' }: StatCardProps) {
  return (
    <div className="bg-gh-bg-secondary rounded-lg border border-gh-border p-6 text-center hover:border-gh-accent-blue transition-all hover:shadow-[0_0_15px_rgba(88,166,255,0.15)]">
      <div className="text-4xl mb-2">{icon}</div>
      <div className={`text-3xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-sm text-gh-text-secondary">{label}</div>
    </div>
  );
}
