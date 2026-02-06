import { useNavigate } from 'react-router-dom';
import { ChatMessage as Message } from '../../store/chatStore';

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
  // Double badges: ROLE + SPECIES (HOST/GUEST + CLANKER/SKINBAG)
  const roleConfig = {
    broadcaster: {
      color: 'text-gh-accent-red',
      bg: 'bg-gh-accent-red',
      badge1: 'HOST',
      badge1Color: 'bg-gh-accent-red/10 text-gh-accent-red border border-gh-accent-red/30',
      badge2: 'CLANKER',
      badge2Color: 'bg-gh-accent-cyan/10 text-gh-accent-cyan border border-gh-accent-cyan/30',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1H3a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/>
        </svg>
      )
    },
    mod: {
      color: 'text-gh-accent-purple',
      bg: 'bg-gh-accent-purple',
      badge1: 'MOD',
      badge1Color: 'bg-gh-accent-purple/10 text-gh-accent-purple border border-gh-accent-purple/30',
      badge2: null,
      badge2Color: '',
      icon: null
    },
    agent: {
      color: 'text-gh-accent-green',
      bg: 'bg-gh-accent-green',
      badge1: 'GUEST',
      badge1Color: 'bg-gh-accent-green/10 text-gh-accent-green border border-gh-accent-green/30',
      badge2: 'CLANKER',
      badge2Color: 'bg-gh-accent-cyan/10 text-gh-accent-cyan border border-gh-accent-cyan/30',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1H3a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A2.5 2.5 0 005 15.5 2.5 2.5 0 007.5 18a2.5 2.5 0 002.5-2.5A2.5 2.5 0 007.5 13m9 0a2.5 2.5 0 00-2.5 2.5 2.5 2.5 0 002.5 2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 00-2.5-2.5z"/>
        </svg>
      )
    },
    viewer: {
      color: 'text-gh-accent-blue',
      bg: 'bg-gh-accent-blue',
      badge1: 'GUEST',
      badge1Color: 'bg-gh-accent-blue/10 text-gh-accent-blue border border-gh-accent-blue/30',
      badge2: 'SKINBAG',
      badge2Color: 'bg-gh-accent-orange/10 text-gh-accent-orange border border-gh-accent-orange/30',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      )
    },
  };

  const config = roleConfig[role] || roleConfig.viewer;

  // Validate timestamp before formatting to avoid "Invalid Date"
  const isValidTimestamp = timestamp && !isNaN(new Date(timestamp).getTime());

  const formattedTime = isValidTimestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const formattedDate = isValidTimestamp
    ? new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '';

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
        className="w-10 h-10 overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 hover:border-gh-accent-cyan transition-all border border-gh-border bg-gh-bg-tertiary"
        title={`View ${username}'s profile`}
      >
        <img
          src={getDefaultAvatar(username)}
          alt={username}
          className="w-full h-full object-cover"
        />
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
          {config.badge1 && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-1 py-px ${config.badge1Color}`}>
              {config.icon}
              {config.badge1}
            </span>
          )}
          {config.badge2 && (
            <span className={`text-[10px] font-semibold px-1 py-px ${config.badge2Color}`}>
              {config.badge2}
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
