import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string, gifUrl?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = 'Type a message...' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showGifPicker, setShowGifPicker] = useState(false);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage('');
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
  };

  return (
    <div className="chat-input border-t border-gh-border bg-gh-bg-secondary">
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          onClick={() => setShowGifPicker(!showGifPicker)}
          className="px-3 py-3 sm:py-2 rounded-md border border-gh-border bg-gh-bg-tertiary text-gh-text-primary hover:bg-gh-bg-primary transition-colors min-h-[44px] sm:min-h-0 text-base sm:text-sm"
          title="Add GIF"
          disabled={disabled}
        >
          GIF
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-4 py-3 sm:py-2 rounded-md border border-gh-border bg-gh-bg-tertiary text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:ring-2 focus:ring-gh-accent-blue disabled:opacity-50 min-h-[44px] sm:min-h-0 text-base sm:text-sm"
          maxLength={500}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="px-4 py-3 sm:py-2 rounded-md bg-gh-accent-blue text-gh-bg-primary font-medium hover:opacity-80 hover:shadow-neon-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] sm:min-h-0 text-base sm:text-sm"
        >
          Send
        </button>
      </div>

      {showGifPicker && (
        <div className="p-3 border-t border-gh-border">
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        </div>
      )}
    </div>
  );
}

// Simple GIF picker component
interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const searchGifs = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(query)}&provider=tenor`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.results)) {
        setGifs(data.data.results.slice(0, 12)); // Show top 12
      }
    } catch (err) {
      console.error('Failed to search GIFs:', err);
    }
    setLoading(false);
  };

  return (
    <div className="gif-picker">
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchGifs()}
          placeholder="Search GIFs..."
          className="flex-1 px-3 py-3 sm:py-2 rounded-md border border-gh-border bg-gh-bg-tertiary text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:ring-2 focus:ring-gh-accent-blue min-h-[44px] sm:min-h-0 text-base sm:text-sm"
        />
        <button
          onClick={searchGifs}
          className="px-4 py-3 sm:py-2 rounded-md bg-gh-accent-blue text-gh-bg-primary hover:opacity-80 hover:shadow-neon-cyan min-h-[44px] sm:min-h-0 text-base sm:text-sm"
        >
          Search
        </button>
        <button
          onClick={onClose}
          className="px-3 py-3 sm:py-2 rounded-md border border-gh-border hover:bg-gh-bg-primary min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
        >
          ✕
        </button>
      </div>

      {loading && <div className="text-center text-gh-text-secondary">Searching...</div>}

      {gifs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {gifs.map((gif, i) => (
            <img
              key={i}
              src={gif.media_formats?.tinygif?.url || gif.url}
              alt={gif.content_description}
              className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80 border border-gh-border active:scale-95 transition-transform"
              onClick={() => onSelect(gif.media_formats?.gif?.url || gif.url)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
