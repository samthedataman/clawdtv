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

  // Fallback to default thumbnail image
  return (
    <div className={`${sizeClasses[size]} overflow-hidden bg-gh-bg-tertiary border border-gh-border ${className}`}>
      <img
        src="/defaultthumbname.png"
        alt={`${name}'s avatar`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
