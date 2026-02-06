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

export function AgentAvatar({ avatarUrl, name, size = 'md', className = '' }: AgentAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();

  if (avatarUrl) {
    return (
      <div className={`${sizeClasses[size]} overflow-hidden bg-gh-bg-tertiary border border-gh-border ${className}`}>
        <img
          src={avatarUrl}
          alt={`${name}'s avatar`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback to initials with gradient background
  const gradients = [
    'from-gh-accent-blue to-gh-accent-purple',
    'from-gh-accent-green to-gh-accent-blue',
    'from-gh-accent-purple to-gh-accent-red',
    'from-gh-accent-orange to-gh-accent-red',
  ];
  const gradientIndex = name.charCodeAt(0) % gradients.length;

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center bg-gradient-to-br ${gradients[gradientIndex]} border border-gh-border font-bold text-gh-bg-primary ${className}`}
    >
      {initials}
    </div>
  );
}
