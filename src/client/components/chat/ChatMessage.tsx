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
  // Discord-style role colors
  const roleConfig = {
    broadcaster: {
      color: 'text-[#f23f42]',
      bg: 'bg-[#f23f42]',
      badge: 'HOST',
      badgeColor: 'bg-[#f23f42]/10 text-[#f23f42] border border-[#f23f42]/30'
    },
    mod: {
      color: 'text-[#9b59b6]',
      bg: 'bg-[#9b59b6]',
      badge: 'MOD',
      badgeColor: 'bg-[#9b59b6]/10 text-[#9b59b6] border border-[#9b59b6]/30'
    },
    agent: {
      color: 'text-[#3ba55c]',
      bg: 'bg-[#3ba55c]',
      badge: 'BOT',
      badgeColor: 'bg-[#5865f2]/10 text-[#5865f2] border border-[#5865f2]/30'
    },
    viewer: {
      color: 'text-[#00b0f4]',
      bg: 'bg-[#00b0f4]',
      badge: null,
      badgeColor: ''
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
      <div className="group relative flex items-start gap-4 py-0.5 px-4 hover:bg-[#2e3035]/30">
        <div className="w-10 flex-shrink-0 flex items-center justify-end">
          <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 transition-opacity">
            {formattedTime}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#dbdee1] text-[15px] break-words leading-[1.375rem]">{content}</p>
          {gifUrl && (
            <img
              src={gifUrl}
              alt="GIF"
              className="mt-1 max-w-[400px] max-h-[300px] object-contain rounded-lg"
              loading="lazy"
            />
          )}
        </div>
      </div>
    );
  }

  // Full message with avatar
  return (
    <div className="group relative flex items-end gap-4 py-1 px-4 mt-[17px] first:mt-0 hover:bg-[#2e3035]/30">
      {/* Square avatar at bottom - clickable */}
      <button
        onClick={handleUserClick}
        className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-white/20 transition-all flex items-center justify-center bg-gh-accent-purple/20 border border-gh-accent-purple text-gh-accent-purple font-bold text-sm"
        title={`View ${username}'s profile`}
      >
        {username.slice(0, 2).toUpperCase()}
      </button>

      {/* Message content */}
      <div className="flex-1 min-w-0 -mt-0.5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUserClick}
            className={`font-medium text-[15px] ${config.color} hover:underline cursor-pointer`}
          >
            {username}
          </button>
          {config.badge && (
            <span className={`text-[10px] font-semibold px-1 py-px rounded ${config.badgeColor}`}>
              {config.badge}
            </span>
          )}
          <span className="text-xs text-[#949ba4]">
            {formattedDate} at {formattedTime}
          </span>
        </div>

        {/* Message text */}
        <p className="text-[#dbdee1] text-[15px] break-words leading-[1.375rem] mt-0.5">{content}</p>

        {/* GIF attachment */}
        {gifUrl && (
          <img
            src={gifUrl}
            alt="GIF"
            className="mt-1 max-w-[400px] max-h-[300px] object-contain rounded-lg"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}
