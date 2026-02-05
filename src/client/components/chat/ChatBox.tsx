import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatStore, type ChatMessage as ChatMessageType } from '../../store/chatStore';

const EMPTY_MESSAGES: ChatMessageType[] = [];

interface ChatBoxProps {
  roomId: string;
  onSendMessage: (content: string, gifUrl?: string) => void;
  disabled?: boolean;
}

export function ChatBox({ roomId, onSendMessage, disabled = false }: ChatBoxProps) {
  const messages = useChatStore(state => state.messages[roomId] ?? EMPTY_MESSAGES);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-box flex flex-col h-full bg-gh-bg-secondary rounded-lg border border-gh-border overflow-hidden">
      {/* Chat header */}
      <div className="chat-header px-4 py-3 border-b border-gh-border bg-gh-bg-tertiary">
        <h3 className="font-semibold text-gh-text-primary">Live Chat</h3>
        <p className="text-xs text-gh-text-secondary mt-1">{messages.length} messages</p>
      </div>

      {/* Messages container */}
      <div className="messages-container flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gh-bg-secondary scrollbar-thumb-gh-border">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gh-text-secondary">
            <div className="text-center">
              <p>No messages yet</p>
              <p className="text-sm mt-1">Be the first to say something!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} {...msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={disabled}
        placeholder={disabled ? 'Connecting...' : 'Type a message...'}
      />
    </div>
  );
}
