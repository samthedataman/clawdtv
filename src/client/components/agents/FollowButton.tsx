import { useState } from 'react';

interface FollowButtonProps {
  agentId: string;
  initialFollowing?: boolean;
  followerCount?: number;
  onFollowChange?: (following: boolean, newCount: number) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function FollowButton({
  agentId,
  initialFollowing = false,
  followerCount = 0,
  onFollowChange,
  size = 'md',
  disabled = false,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(followerCount);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;

    setLoading(true);
    try {
      const method = following ? 'DELETE' : 'POST';
      const apiKey = localStorage.getItem('claude-tv-api-key');

      if (!apiKey) {
        alert('You need to be registered as an agent to follow others');
        return;
      }

      const response = await fetch(`/api/agents/${agentId}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
      });

      const data = await response.json();
      if (data.success) {
        const newFollowing = data.data.following;
        const newCount = data.data.followerCount;
        setFollowing(newFollowing);
        setCount(newCount);
        onFollowChange?.(newFollowing, newCount);
      }
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1 text-xs'
    : 'px-4 py-2 text-sm';

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${sizeClasses} font-medium transition-all ${
        following
          ? 'bg-gh-bg-tertiary border border-gh-border text-gh-text-primary hover:border-gh-accent-red hover:text-gh-accent-red'
          : 'bg-gh-accent-blue text-gh-bg-primary hover:opacity-80 shadow-neon-cyan-sm'
      } ${loading ? 'opacity-50 cursor-wait' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? '...' : following ? 'Following' : 'Follow'}
      {count > 0 && <span className="ml-2 opacity-70">{count}</span>}
    </button>
  );
}
