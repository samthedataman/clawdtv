import { useNavigate } from 'react-router-dom';
import { ChatMessage as Message } from '../../store/chatStore';

interface ChatMessageProps extends Message {
  isGrouped?: boolean;
}

export function ChatMessage({
  id,
  userId,
  username,
  content,
  role,
  timestamp,
  gifUrl,
  isGrouped = false,
}: ChatMessageProps) {
  const navigate = useNavigate();

  // Navigate to agent profile when avatar/username is clicked
  const handleUserClick = () => {
    if (role === 'agent' || role === 'broadcaster') {
      // Navigate to agent profile page
      navigate(`/agents/${encodeURIComponent(userId || username)}`);
    }
  };
  // Terminal-style role colors (cyberpunk theme)
  // Broadcasters get video cam icon, viewers get eye icon
  const roleConfig = {
    broadcaster: {
      color: 'text-gh-accent-red',
      bg: 'bg-gh-accent-red',
      badge: 'HOST',
      badgeColor: 'bg-gh-accent-red/10 text-gh-accent-red border border-gh-accent-red/30',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
      )
    },
    mod: {
      color: 'text-gh-accent-purple',
      bg: 'bg-gh-accent-purple',
      badge: 'MOD',
      badgeColor: 'bg-gh-accent-purple/10 text-gh-accent-purple border border-gh-accent-purple/30',
      icon: null
    },
    agent: {
      color: 'text-gh-accent-green',
      bg: 'bg-gh-accent-green',
      badge: 'BOT',
      badgeColor: 'bg-gh-accent-cyan/10 text-gh-accent-cyan border border-gh-accent-cyan/30',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      )
    },
    viewer: {
      color: 'text-gh-accent-blue',
      bg: 'bg-gh-accent-blue',
      badge: null,
      badgeColor: '',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      )
    },
  };

  const config = roleConfig[role] || roleConfig.viewer;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDate = new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  // Grouped message (compact)
  if (isGrouped) {
    return (
      <div className="group relative flex items-start gap-4 py-0.5 px-4 hover:bg-gh-bg-secondary/50">
        <div className="w-10 flex-shrink-0 flex items-center justify-end">
          <span className="text-[10px] text-gh-text-secondary opacity-0 group-hover:opacity-100 transition-opacity font-mono">
            {formattedTime}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gh-text-primary text-sm break-words leading-[1.375rem] font-mono">{content}</p>
          {gifUrl && (
            <img
              src={gifUrl}
              alt="GIF"
              className="mt-1 max-w-[400px] max-h-[300px] object-contain border border-gh-border"
              loading="lazy"
            />
          )}
        </div>
      </div>
    );
  }

  // Full message with avatar
  return (
    <div className="group relative flex items-end gap-4 py-1 px-4 mt-[17px] first:mt-0 hover:bg-gh-bg-secondary/50">
      {/* Square avatar at bottom - clickable */}
      <button
        onClick={handleUserClick}
        className="w-10 h-10 overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 hover:border-gh-accent-cyan transition-all flex items-center justify-center bg-gh-accent-purple/20 border border-gh-accent-purple text-gh-accent-purple font-bold text-sm"
        title={`View ${username}'s profile`}
      >
        {username.slice(0, 2).toUpperCase()}
      </button>

      {/* Message content */}
      <div className="flex-1 min-w-0 -mt-0.5">
        {/* Header */}
        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={handleUserClick}
            className={`font-medium text-sm ${config.color} hover:underline cursor-pointer`}
          >
            {username}
          </button>
          {config.badge ? (
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-1 py-px ${config.badgeColor}`}>
              {config.icon}
              {config.badge}
            </span>
          ) : config.icon && (
            <span className="text-gh-text-secondary">
              {config.icon}
            </span>
          )}
          <span className="text-xs text-gh-text-secondary">
            {formattedDate} @ {formattedTime}
          </span>
        </div>

        {/* Message text */}
        <p className="text-gh-text-primary text-sm break-words leading-[1.375rem] mt-0.5 font-mono">{content}</p>

        {/* GIF attachment */}
        {gifUrl && (
          <img
            src={gifUrl}
            alt="GIF"
            className="mt-1 max-w-[400px] max-h-[300px] object-contain border border-gh-border"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}
