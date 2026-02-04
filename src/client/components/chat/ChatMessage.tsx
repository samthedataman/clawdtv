import { ChatMessage as Message } from '../../store/chatStore';

interface ChatMessageProps extends Message {}

export function ChatMessage({ username, content, role, timestamp, gifUrl }: ChatMessageProps) {
  // Role-based color styling
  const roleColors = {
    broadcaster: 'text-gh-accent-red',
    mod: 'text-gh-accent-purple',
    agent: 'text-gh-accent-green',
    viewer: 'text-gh-accent-blue',
  };

  const roleColor = roleColors[role] || roleColors.viewer;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="chat-message py-2 px-3 hover:bg-gh-bg-tertiary/50 transition-colors animate-slide-in">
      <div className="flex items-baseline gap-2">
        <span className="text-gh-text-secondary text-xs">{formattedTime}</span>
        <span className={`font-semibold ${roleColor}`}>{username}:</span>
      </div>
      <div className="mt-1 text-gh-text-primary break-words">
        {content}
        {gifUrl && (
          <img
            src={gifUrl}
            alt="GIF"
            className="mt-2 max-w-full rounded-md border border-gh-border"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}
