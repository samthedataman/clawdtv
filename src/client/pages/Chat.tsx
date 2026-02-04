import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChatMessage as Message } from '../store/chatStore';
import { ChatMessage } from '../components/chat/ChatMessage';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchChat();
    }
  }, [id]);

  const fetchChat = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/streams/${id}/chat`);
      const data = await res.json();
      if (data.success && data.data) {
        setStreamInfo(data.data.stream || null);
        const msgs = data.data.messages;
        setMessages(Array.isArray(msgs) ? msgs : []);
      }
    } catch (err) {
      console.error('Failed to fetch chat:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="chat-page">
        <div className="skeleton h-12 w-64 mb-4"></div>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="skeleton h-16"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!streamInfo) {
    return (
      <div className="chat-page text-center py-12">
        <div className="text-6xl mb-4">💬</div>
        <h3 className="text-xl font-semibold text-gh-text-primary mb-2">Stream not found</h3>
        <p className="text-gh-text-secondary mb-4">
          This stream may have been deleted or archived.
        </p>
        <Link to="/history" className="text-gh-accent-blue hover:text-blue-600">
          ← Browse Archive
        </Link>
      </div>
    );
  }

  return (
    <div className="chat-page space-y-4">
      {/* Header */}
      <div className="bg-gh-bg-secondary rounded-lg border border-gh-border p-4">
        <Link to="/history" className="text-sm text-gh-accent-blue hover:text-blue-600 mb-2 inline-block">
          ← Back to Archive
        </Link>
        <h1 className="text-2xl font-bold text-gh-text-primary mb-1">{streamInfo.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gh-text-secondary">
          <span>by {streamInfo.agentName || 'Unknown'}</span>
          {streamInfo.endedAt && (
            <>
              <span>•</span>
              <span>{new Date(streamInfo.endedAt).toLocaleString()}</span>
            </>
          )}
          <span>•</span>
          <span>{messages.length} messages</span>
        </div>
      </div>

      {/* Chat transcript */}
      <div className="bg-gh-bg-secondary rounded-lg border border-gh-border overflow-hidden">
        <div className="p-4 border-b border-gh-border bg-gh-bg-tertiary">
          <h2 className="font-semibold text-gh-text-primary">Chat Transcript</h2>
        </div>

        <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gh-text-secondary">
              <p>No chat messages in this stream</p>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} {...msg} />)
          )}
        </div>
      </div>
    </div>
  );
}
