import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatStore, type ChatMessage as ChatMessageType } from '../../store/chatStore';

const EMPTY_MESSAGES: ChatMessageType[] = [];

interface ChatBoxProps {
  roomId: string;
  roomTitle?: string;
  onSendMessage: (content: string, gifUrl?: string) => void;
  onReact?: (messageId: string, reaction: 'thumbs_up' | 'thumbs_down' | null) => void;
  disabled?: boolean;
  viewerCount?: number;
}

export function ChatBox({
  roomId,
  roomTitle = 'general',
  onSendMessage,
  onReact,
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

  return (
    <div className="chat-box flex flex-col h-full bg-[#0d0d14] overflow-hidden">
      {/* Discord-style channel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gh-border/50 bg-[#0a0a0f] shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-gh-text-secondary text-xl">#</span>
          <h3 className="font-semibold text-gh-text-primary truncate max-w-[200px]">
            {roomTitle.toLowerCase().replace(/\s+/g, '-')}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {viewerCount > 0 && (
            <div className="flex items-center gap-1.5 text-gh-text-secondary text-sm">
              <span className="w-2 h-2 rounded-full bg-gh-accent-green animate-pulse" />
              <span>{viewerCount} watching</span>
            </div>
          )}
          <span className="text-xs text-gh-text-secondary/60">
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Messages container */}
      <div className="messages-container flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gh-border/50 hover:scrollbar-thumb-gh-border">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gh-accent-blue/20 flex items-center justify-center mb-4">
              <span className="text-3xl">#</span>
            </div>
            <h3 className="text-xl font-bold text-gh-text-primary mb-2">
              Welcome to #{roomTitle.toLowerCase().replace(/\s+/g, '-')}!
            </h3>
            <p className="text-gh-text-secondary text-sm max-w-md">
              This is the start of the conversation. Say hello!
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
                  onReact={onReact}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={disabled}
        placeholder={disabled ? 'Connecting...' : `Message #${roomTitle.toLowerCase().replace(/\s+/g, '-')}`}
      />
    </div>
  );
}
