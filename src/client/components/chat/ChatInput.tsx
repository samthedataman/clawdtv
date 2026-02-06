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
    <div className="chat-input px-4 pb-4 pt-2 bg-gh-bg-secondary border-t border-gh-border">
      {/* GIF Picker */}
      {showGifPicker && (
        <div className="mb-3 p-3 bg-gh-bg-tertiary border border-gh-border">
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        </div>
      )}

      {/* Terminal-style input bar */}
      <div className="flex items-center gap-0 bg-gh-bg-primary border border-gh-border overflow-hidden">
        {/* Plus button for attachments */}
        <button
          onClick={() => setShowGifPicker(!showGifPicker)}
          className={`px-4 py-2.5 text-gh-text-secondary hover:text-gh-accent-cyan transition-colors ${showGifPicker ? 'text-gh-accent-cyan' : ''}`}
          title="Add GIF"
          disabled={disabled}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeWidth="2" strokeLinecap="round" d="M12 8v8M8 12h8" />
          </svg>
        </button>

        {/* Terminal prompt */}
        <span className="text-gh-accent-green font-mono">{'>'}</span>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 py-2.5 px-2 bg-transparent text-gh-text-primary placeholder-gh-text-secondary focus:outline-none disabled:opacity-50 text-sm font-mono"
          maxLength={500}
        />

        {/* Send button (only shows when there's text) */}
        {message.trim() && (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="px-3 py-2.5 text-gh-accent-green hover:text-gh-accent-cyan disabled:opacity-50 transition-colors"
            title="Send message"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Discord-style GIF picker with category tabs
interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

const GIF_CATEGORIES = [
  // Crypto & Finance
  { label: 'Bitcoin', query: 'bitcoin btc moon' },
  { label: 'Ethereum', query: 'ethereum vitalik' },
  { label: 'Pump', query: 'stonks pump moon rocket' },
  { label: 'Dump', query: 'crash dump rekt falling' },
  { label: 'WAGMI', query: 'wagmi diamond hands hold' },
  { label: 'Rug', query: 'rug pull scam running' },
  // Drama & Reactions
  { label: 'Drama', query: 'drama popcorn tea spill' },
  { label: 'Shocked', query: 'shocked surprised omg' },
  { label: 'Cope', query: 'cope crying sad' },
  { label: 'W', query: 'winner celebration dance' },
  { label: 'L', query: 'loser fail cringe' },
  // Tech & AI
  { label: 'AI', query: 'artificial intelligence robot' },
  { label: 'Coding', query: 'programming hacker typing' },
  // Sports
  { label: 'Sports', query: 'sports touchdown goal' },
  { label: 'NFL', query: 'nfl football touchdown' },
];

function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Bitcoin');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load default category on mount
  useEffect(() => {
    searchByCategory('Bitcoin');
    inputRef.current?.focus();
  }, []);

  const searchByCategory = async (category: string) => {
    setActiveCategory(category);
    const cat = GIF_CATEGORIES.find(c => c.label === category);
    if (!cat) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(cat.query)}&provider=tenor&limit=16`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.gifs)) {
        setGifs(data.data.gifs);
      }
    } catch (err) {
      console.error('Failed to load GIFs:', err);
    }
    setLoading(false);
  };

  const searchGifs = async () => {
    if (!query.trim()) {
      searchByCategory(activeCategory);
      return;
    }

    setActiveCategory('');
    setLoading(true);
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(query)}&provider=tenor&limit=16`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.gifs)) {
        setGifs(data.data.gifs);
      }
    } catch (err) {
      console.error('Failed to search GIFs:', err);
    }
    setLoading(false);
  };

  return (
    <div className="gif-picker font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gh-accent-cyan">// select_gif</h4>
        <button
          onClick={onClose}
          className="text-gh-text-secondary hover:text-gh-accent-red transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchGifs()}
            placeholder="search_tenor..."
            className="w-full px-3 py-2 bg-gh-bg-primary border border-gh-border text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-cyan text-sm"
          />
          <button
            onClick={searchGifs}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gh-text-secondary hover:text-gh-accent-cyan"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path strokeWidth="2" strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {GIF_CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => {
              setQuery('');
              searchByCategory(cat.label);
            }}
            className={`px-3 py-1 text-xs whitespace-nowrap transition-colors border ${
              activeCategory === cat.label
                ? 'bg-gh-accent-cyan/20 text-gh-accent-cyan border-gh-accent-cyan'
                : 'bg-gh-bg-primary text-gh-text-secondary border-gh-border hover:border-gh-accent-cyan hover:text-gh-text-primary'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-video bg-gh-bg-primary border border-gh-border animate-pulse" />
          ))}
        </div>
      ) : gifs.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto">
          {gifs.map((gif, i) => (
            <button
              key={gif.id || i}
              onClick={() => onSelect(gif.url)}
              className="relative aspect-video overflow-hidden border border-gh-border hover:border-gh-accent-cyan transition-all group"
            >
              <img
                src={gif.preview || gif.url}
                alt={gif.title || 'GIF'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gh-text-secondary text-sm">
          // no_results_found
        </div>
      )}
    </div>
  );
}
