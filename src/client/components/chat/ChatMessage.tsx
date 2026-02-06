import { ChatMessage as Message, MessageReactions } from '../../store/chatStore';

interface ChatMessageProps extends Message {
  isGrouped?: boolean; // True if this message follows another from same user
  onReact?: (messageId: string, reaction: 'thumbs_up' | 'thumbs_down' | null) => void;
}

export function ChatMessage({
  id,
  username,
  content,
  role,
  timestamp,
  gifUrl,
  reactions,
  isGrouped = false,
  onReact,
}: ChatMessageProps) {
  // Role-based colors (Discord-style)
  const roleConfig = {
    broadcaster: {
      color: 'text-gh-accent-red',
      bg: 'bg-gh-accent-red',
      badge: 'LIVE',
      badgeBg: 'bg-gh-accent-red/20 text-gh-accent-red'
    },
    mod: {
      color: 'text-gh-accent-purple',
      bg: 'bg-gh-accent-purple',
      badge: 'MOD',
      badgeBg: 'bg-gh-accent-purple/20 text-gh-accent-purple'
    },
    agent: {
      color: 'text-gh-accent-green',
      bg: 'bg-gh-accent-green',
      badge: 'BOT',
      badgeBg: 'bg-gh-accent-green/20 text-gh-accent-green'
    },
    viewer: {
      color: 'text-gh-accent-blue',
      bg: 'bg-gh-accent-blue',
      badge: null,
      badgeBg: ''
    },
  };

  const config = roleConfig[role] || roleConfig.viewer;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Get avatar initial(s)
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const handleReaction = (reaction: 'thumbs_up' | 'thumbs_down') => {
    if (!onReact) return;
    // Toggle off if already selected, otherwise set
    if (reactions?.userReaction === reaction) {
      onReact(id, null);
    } else {
      onReact(id, reaction);
    }
  };

  // Reaction buttons component
  const ReactionButtons = () => {
    const thumbsUp = reactions?.thumbsUp || 0;
    const thumbsDown = reactions?.thumbsDown || 0;
    const userReaction = reactions?.userReaction;
    const hasReactions = thumbsUp > 0 || thumbsDown > 0;

    return (
      <div className={`flex items-center gap-1 mt-1 ${hasReactions ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <button
          onClick={() => handleReaction('thumbs_up')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
            userReaction === 'thumbs_up'
              ? 'bg-gh-accent-green/20 text-gh-accent-green'
              : 'hover:bg-gh-bg-tertiary text-gh-text-secondary hover:text-gh-accent-green'
          }`}
          title="Thumbs up"
        >
          <span>👍</span>
          {thumbsUp > 0 && <span>{thumbsUp}</span>}
        </button>
        <button
          onClick={() => handleReaction('thumbs_down')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
            userReaction === 'thumbs_down'
              ? 'bg-gh-accent-red/20 text-gh-accent-red'
              : 'hover:bg-gh-bg-tertiary text-gh-text-secondary hover:text-gh-accent-red'
          }`}
          title="Thumbs down"
        >
          <span>👎</span>
          {thumbsDown > 0 && <span>{thumbsDown}</span>}
        </button>
      </div>
    );
  };

  // Grouped message (same user, consecutive) - compact layout
  if (isGrouped) {
    return (
      <div className="group flex items-start gap-4 py-0.5 px-4 hover:bg-gh-bg-tertiary/30">
        {/* Timestamp placeholder (shows on hover) */}
        <div className="w-10 flex-shrink-0 text-right">
          <span className="text-[10px] text-gh-text-secondary/0 group-hover:text-gh-text-secondary/60 transition-colors">
            {formattedTime}
          </span>
        </div>
        {/* Message content */}
        <div className="flex-1 min-w-0">
          <p className="text-gh-text-primary text-sm break-words leading-relaxed">{content}</p>
          {gifUrl && (
            <img
              src={gifUrl}
              alt="GIF"
              className="mt-2 max-w-[300px] max-h-[200px] object-contain rounded border border-gh-border/50"
              loading="lazy"
            />
          )}
          {onReact && <ReactionButtons />}
        </div>
      </div>
    );
  }

  // Full message with avatar
  return (
    <div className="group flex items-start gap-4 py-2 px-4 hover:bg-gh-bg-tertiary/30 mt-3 first:mt-0">
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0 shadow-lg`}
        title={username}
      >
        <span className="text-gh-bg-primary font-bold text-sm">
          {getInitials(username)}
        </span>
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Header: username, badge, timestamp */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`font-semibold text-sm ${config.color} hover:underline cursor-pointer`}>
            {username}
          </span>
          {config.badge && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.badgeBg} uppercase tracking-wider`}>
              {config.badge}
            </span>
          )}
          <span className="text-xs text-gh-text-secondary/60">
            {formattedTime}
          </span>
        </div>

        {/* Message text */}
        <p className="text-gh-text-primary text-sm break-words leading-relaxed">{content}</p>

        {/* GIF attachment */}
        {gifUrl && (
          <img
            src={gifUrl}
            alt="GIF"
            className="mt-2 max-w-[300px] max-h-[200px] object-contain rounded border border-gh-border/50"
            loading="lazy"
          />
        )}

        {/* Reaction buttons */}
        {onReact && <ReactionButtons />}
      </div>
    </div>
  );
}
