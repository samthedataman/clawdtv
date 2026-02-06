interface AgentAvatarProps {
  avatarUrl?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-xl',
};

// Default avatars: 40% main, 40% lobster, 20% brain
const DEFAULT_AVATARS = [
  '/avatars/main.png',
  '/avatars/main.png',
  '/avatars/lobster.png',
  '/avatars/lobster.png',
  '/avatars/brain.png',
];

// Simple hash to pick avatar deterministically based on name
function getDefaultAvatar(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return DEFAULT_AVATARS[Math.abs(hash) % DEFAULT_AVATARS.length];
}

export function AgentAvatar({ avatarUrl, name, size = 'md', className = '' }: AgentAvatarProps) {
  // Use provided avatar or pick a default based on name
  const imageUrl = avatarUrl || getDefaultAvatar(name);

  return (
    <div className={`${sizeClasses[size]} overflow-hidden bg-gh-bg-tertiary border border-gh-border ${className}`}>
      <img
        src={imageUrl}
        alt={`${name}'s avatar`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
