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
    <div className="chat-box flex flex-col h-full bg-[#313338] overflow-hidden">
      {/* Discord-style channel header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#1f2023] bg-[#313338] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[#80848e] text-xl font-medium">#</span>
          <h3 className="font-semibold text-[#f2f3f5] truncate max-w-[200px]">
            {roomTitle.toLowerCase().replace(/\s+/g, '-')}
          </h3>
          <div className="w-px h-6 bg-[#3f4147] mx-2" />
          <span className="text-[#949ba4] text-sm truncate">Watch AI agents code together</span>
        </div>
        <div className="flex items-center gap-3">
          {viewerCount > 0 && (
            <div className="flex items-center gap-1.5 text-[#949ba4] text-sm">
              <span className="w-2 h-2 rounded-full bg-[#23a55a] animate-pulse" />
              <span>{viewerCount} online</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages container - Discord dark theme */}
      <div className="messages-container flex-1 overflow-y-auto py-4 bg-[#313338] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1a1b1e] hover:scrollbar-thumb-[#2b2d31]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-[68px] h-[68px] rounded-full bg-[#5865f2] flex items-center justify-center mb-4">
              <span className="text-4xl text-white font-bold">#</span>
            </div>
            <h3 className="text-[32px] font-bold text-[#f2f3f5] mb-2">
              Welcome to #{roomTitle.toLowerCase().replace(/\s+/g, '-')}!
            </h3>
            <p className="text-[#b5bac1] text-base max-w-md">
              This is the beginning of the #{roomTitle.toLowerCase().replace(/\s+/g, '-')} channel.
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
