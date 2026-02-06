import { useEffect, useRef, useMemo } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatStore, type ChatMessage as ChatMessageType } from '../../store/chatStore';

const EMPTY_MESSAGES: ChatMessageType[] = [];

interface ChatBoxProps {
  roomId: string;
  roomTitle?: string;
  onSendMessage: (content: string, gifUrl?: string) => void;
  disabled?: boolean;
  viewerCount?: number;
}

export function ChatBox({
  roomId,
  roomTitle = 'general',
  onSendMessage,
  disabled = false,
  viewerCount = 0
}: ChatBoxProps) {
  const messages = useChatStore(state => state.messages[roomId] ?? EMPTY_MESSAGES);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if a message should be grouped (same user as previous, within 5 min)
  const shouldGroupMessage = (msg: ChatMessageType, prevMsg: ChatMessageType | null): boolean => {
    if (!prevMsg) return false;
    if (msg.userId !== prevMsg.userId) return false;
    // Group if within 5 minutes
    const timeDiff = msg.timestamp - prevMsg.timestamp;
    return timeDiff < 5 * 60 * 1000;
  };

  // Get unique participants from messages (most recent first)
  const participants = useMemo(() => {
    const seen = new Map<string, { username: string; role: string; userId: string }>();
    // Iterate backwards to get most recent appearance of each user
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!seen.has(msg.userId)) {
        seen.set(msg.userId, { username: msg.username, role: msg.role, userId: msg.userId });
      }
    }
    return Array.from(seen.values()).slice(0, 10); // Limit to 10 avatars
  }, [messages]);

  return (
    <div className="chat-box flex flex-col h-full bg-gh-bg-primary overflow-hidden font-mono">
      {/* Terminal-style header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-gh-border bg-gh-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-gh-accent-green font-bold">{'>'}</span>
          <h3 className="font-medium text-gh-accent-cyan truncate max-w-[200px]">
            {roomTitle.toLowerCase().replace(/\s+/g, '_')}
          </h3>
          <span className="text-gh-text-secondary text-xs">// live chat</span>
        </div>
        <div className="flex items-center gap-3">
          {viewerCount > 0 && (
            <div className="flex items-center gap-1.5 text-gh-accent-green text-xs">
              <span className="w-2 h-2 rounded-full bg-gh-accent-green animate-pulse" />
              <span>{viewerCount} connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages container - Terminal dark theme */}
      <div className="messages-container flex-1 overflow-y-auto py-2 bg-gh-bg-primary scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gh-border hover:scrollbar-thumb-gh-text-secondary">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 font-mono">
            <div className="text-gh-accent-green text-4xl mb-4">{'>'}_</div>
            <h3 className="text-xl font-bold text-gh-accent-cyan mb-2">
              [{roomTitle.toLowerCase().replace(/\s+/g, '_')}]
            </h3>
            <p className="text-gh-text-secondary text-sm">
              // awaiting input...
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const isGrouped = shouldGroupMessage(msg, prevMsg);
              return (
                <ChatMessage
                  key={msg.id}
                  {...msg}
                  isGrouped={isGrouped}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Participants bar above input - terminal style */}
      {participants.length > 0 && (
        <div className="px-4 py-2 bg-gh-bg-secondary border-t border-gh-border">
          <div className="flex items-center gap-2">
            <span className="text-gh-text-secondary text-xs font-mono">// online:</span>
            <div className="flex items-center -space-x-1">
              {participants.map((p) => (
                <button
                  key={p.userId}
                  onClick={() => window.location.href = `/agents/${encodeURIComponent(p.userId || p.username)}`}
                  className="w-6 h-6 flex items-center justify-center text-[10px] font-bold border border-gh-border bg-gh-accent-purple/20 text-gh-accent-purple hover:border-gh-accent-cyan hover:text-gh-accent-cyan transition-colors cursor-pointer"
                  title={`View ${p.username}'s profile`}
                >
                  {p.username.slice(0, 2).toUpperCase()}
                </button>
              ))}
            </div>
            {participants.length > 0 && (
              <span className="text-gh-text-secondary text-xs font-mono">
                {participants.map(p => p.username).slice(0, 3).join(', ')}
                {participants.length > 3 && ` +${participants.length - 3}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chat input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={disabled}
        placeholder={disabled ? 'Connecting...' : `Message #${roomTitle.toLowerCase().replace(/\s+/g, '-')}`}
      />
    </div>
  );
}
