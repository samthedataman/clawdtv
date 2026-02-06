import { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string, gifUrl?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = 'Type a message...' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showGifPicker, setShowGifPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGifSelect = (gifUrl: string) => {
    onSend(message.trim() || '📎', gifUrl);
    setMessage('');
    setShowGifPicker(false);
    inputRef.current?.focus();
  };

  return (
    <div className="chat-input px-4 pb-6 pt-2 bg-[#0d0d14]">
      {/* GIF Picker */}
      {showGifPicker && (
        <div className="mb-3 p-3 rounded-lg bg-[#0a0a0f] border border-gh-border/50">
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        </div>
      )}

      {/* Discord-style input bar */}
      <div className="flex items-center gap-0 bg-[#1a1a2e] rounded-lg overflow-hidden border border-gh-border/30 focus-within:border-gh-accent-blue/50 transition-colors">
        {/* Plus button for attachments */}
        <button
          onClick={() => setShowGifPicker(!showGifPicker)}
          className={`px-4 py-3 text-gh-text-secondary hover:text-gh-text-primary transition-colors ${showGifPicker ? 'text-gh-accent-blue' : ''}`}
          title="Add GIF"
          disabled={disabled}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeWidth="2" strokeLinecap="round" d="M12 8v8M8 12h8" />
          </svg>
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 py-3 pr-4 bg-transparent text-gh-text-primary placeholder-gh-text-secondary/50 focus:outline-none disabled:opacity-50 text-sm"
          maxLength={500}
        />

        {/* Send button (only shows when there's text) */}
        {message.trim() && (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="px-4 py-3 text-gh-accent-blue hover:text-gh-accent-cyan disabled:opacity-50 transition-colors"
            title="Send message"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>

      {/* Hint text */}
      <p className="text-[10px] text-gh-text-secondary/40 mt-2 text-center">
        Press Enter to send
      </p>
    </div>
  );
}

// Discord-style GIF picker
interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoaded, setTrendingLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load trending on mount
  useEffect(() => {
    loadTrending();
    inputRef.current?.focus();
  }, []);

  const loadTrending = async () => {
    if (trendingLoaded) return;
    setLoading(true);
    try {
      const res = await fetch('/api/gif/trending?provider=tenor&limit=12');
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.results)) {
        setGifs(data.data.results);
        setTrendingLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load trending GIFs:', err);
    }
    setLoading(false);
  };

  const searchGifs = async () => {
    if (!query.trim()) {
      loadTrending();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(query)}&provider=tenor&limit=12`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.results)) {
        setGifs(data.data.results);
      }
    } catch (err) {
      console.error('Failed to search GIFs:', err);
    }
    setLoading(false);
  };

  return (
    <div className="gif-picker">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gh-text-primary">GIFs</h4>
        <button
          onClick={onClose}
          className="text-gh-text-secondary hover:text-gh-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchGifs()}
            placeholder="Search Tenor"
            className="w-full px-3 py-2 rounded bg-[#1a1a2e] border border-gh-border/30 text-gh-text-primary placeholder-gh-text-secondary/50 focus:outline-none focus:border-gh-accent-blue/50 text-sm"
          />
          <button
            onClick={searchGifs}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gh-text-secondary hover:text-gh-accent-blue"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path strokeWidth="2" strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-gh-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : gifs.length > 0 ? (
        <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
          {gifs.map((gif, i) => (
            <button
              key={i}
              onClick={() => onSelect(gif.media_formats?.gif?.url || gif.url)}
              className="relative aspect-video overflow-hidden rounded hover:ring-2 hover:ring-gh-accent-blue transition-all"
            >
              <img
                src={gif.media_formats?.tinygif?.url || gif.url}
                alt={gif.content_description || 'GIF'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gh-text-secondary text-sm">
          No GIFs found. Try a different search!
        </div>
      )}
    </div>
  );
}
