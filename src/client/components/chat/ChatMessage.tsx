import { useNavigate } from 'react-router-dom';
import { ChatMessage as Message, MessageReactions } from '../../store/chatStore';

interface ChatMessageProps extends Message {
  isGrouped?: boolean;
  onReact?: (messageId: string, reaction: 'thumbs_up' | 'thumbs_down' | null) => void;
}

export function ChatMessage({
  id,
  userId,
  username,
  content,
  role,
  timestamp,
  gifUrl,
  reactions,
  isGrouped = false,
  onReact,
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

  const handleReaction = (reaction: 'thumbs_up' | 'thumbs_down') => {
    if (!onReact) return;
    if (reactions?.userReaction === reaction) {
      onReact(id, null);
    } else {
      onReact(id, reaction);
    }
  };

  // Discord-style reaction pills
  const ReactionPills = () => {
    const thumbsUp = reactions?.thumbsUp || 0;
    const thumbsDown = reactions?.thumbsDown || 0;
    const userReaction = reactions?.userReaction;
    const hasReactions = thumbsUp > 0 || thumbsDown > 0;

    if (!hasReactions && !onReact) return null;

    return (
      <div className="flex items-center gap-1 mt-1.5">
        {(thumbsUp > 0 || onReact) && (
          <button
            onClick={() => handleReaction('thumbs_up')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
              userReaction === 'thumbs_up'
                ? 'bg-[#5865f2]/30 text-[#dee0fc] border border-[#5865f2]'
                : thumbsUp > 0
                  ? 'bg-[#2b2d31] text-[#b5bac1] border border-[#3f4147] hover:border-[#5865f2]/50'
                  : 'bg-[#2b2d31]/50 text-[#b5bac1]/50 border border-transparent opacity-0 group-hover:opacity-100 hover:bg-[#2b2d31] hover:text-[#b5bac1]'
            }`}
          >
            <span className="text-sm">👍</span>
            {thumbsUp > 0 && <span className="font-medium">{thumbsUp}</span>}
          </button>
        )}
        {(thumbsDown > 0 || onReact) && (
          <button
            onClick={() => handleReaction('thumbs_down')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
              userReaction === 'thumbs_down'
                ? 'bg-[#f23f42]/30 text-[#fcd4d4] border border-[#f23f42]'
                : thumbsDown > 0
                  ? 'bg-[#2b2d31] text-[#b5bac1] border border-[#3f4147] hover:border-[#f23f42]/50'
                  : 'bg-[#2b2d31]/50 text-[#b5bac1]/50 border border-transparent opacity-0 group-hover:opacity-100 hover:bg-[#2b2d31] hover:text-[#b5bac1]'
            }`}
          >
            <span className="text-sm">👎</span>
            {thumbsDown > 0 && <span className="font-medium">{thumbsDown}</span>}
          </button>
        )}
      </div>
    );
  };

  // Hover action buttons (Discord-style)
  const ActionButtons = () => (
    <div className="absolute -top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1e1f22] border border-[#3f4147] rounded shadow-lg flex">
      <button
        onClick={() => handleReaction('thumbs_up')}
        className="p-1.5 hover:bg-[#35373c] text-[#b5bac1] hover:text-white transition-colors"
        title="Add reaction"
      >
        <span className="text-lg">👍</span>
      </button>
      <button
        onClick={() => handleReaction('thumbs_down')}
        className="p-1.5 hover:bg-[#35373c] text-[#b5bac1] hover:text-white transition-colors"
        title="Add reaction"
      >
        <span className="text-lg">👎</span>
      </button>
    </div>
  );

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
          <ReactionPills />
        </div>
        {onReact && <ActionButtons />}
      </div>
    );
  }

  // Full message with avatar
  return (
    <div className="group relative flex items-end gap-4 py-1 px-4 mt-[17px] first:mt-0 hover:bg-[#2e3035]/30">
      {/* Square avatar at bottom - clickable */}
      <button
        onClick={handleUserClick}
        className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-white/20 transition-all"
        title={`View ${username}'s profile`}
      >
        <img
          src="/defaultthumbname.png"
          alt={`${username}'s avatar`}
          className="w-full h-full object-cover"
        />
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

        {/* Reactions */}
        <ReactionPills />
      </div>

      {/* Hover actions */}
      {onReact && <ActionButtons />}
    </div>
  );
}
