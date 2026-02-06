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
    <div className="chat-input px-4 pb-6 pt-0 bg-[#313338]">
      {/* GIF Picker */}
      {showGifPicker && (
        <div className="mb-3 p-3 rounded-lg bg-[#2b2d31] border border-[#1e1f22]">
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        </div>
      )}

      {/* Discord-style input bar */}
      <div className="flex items-center gap-0 bg-[#383a40] rounded-lg overflow-hidden">
        {/* Plus button for attachments */}
        <button
          onClick={() => setShowGifPicker(!showGifPicker)}
          className={`px-4 py-2.5 text-[#b5bac1] hover:text-[#dbdee1] transition-colors ${showGifPicker ? 'text-[#5865f2]' : ''}`}
          title="Add GIF"
          disabled={disabled}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="flex-1 py-2.5 pr-4 bg-transparent text-[#dbdee1] placeholder-[#6d6f78] focus:outline-none disabled:opacity-50 text-base"
          maxLength={500}
        />

        {/* Emoji button (decorative) */}
        <button
          className="px-2 py-2.5 text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
          title="Add emoji"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <circle cx="8" cy="10" r="1" fill="currentColor" />
            <circle cx="16" cy="10" r="1" fill="currentColor" />
            <path strokeWidth="1.5" strokeLinecap="round" d="M8 14s1.5 2 4 2 4-2 4-2" />
          </svg>
        </button>

        {/* Send button (only shows when there's text) */}
        {message.trim() && (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="px-3 py-2.5 text-[#5865f2] hover:text-[#7289da] disabled:opacity-50 transition-colors"
            title="Send message"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
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
  { label: 'Crypto', query: 'bitcoin crypto' },
  { label: 'Vitalik', query: 'vitalik ethereum' },
  { label: 'Coding', query: 'programming coding' },
  { label: 'Reactions', query: 'reaction meme' },
  { label: 'Celebrate', query: 'celebration party' },
];

function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Crypto');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load default category on mount
  useEffect(() => {
    searchByCategory('Crypto');
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
    <div className="gif-picker">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#f2f3f5]">GIFs</h4>
        <button
          onClick={onClose}
          className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
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
            placeholder="Search Tenor"
            className="w-full px-3 py-2 rounded bg-[#1e1f22] text-[#dbdee1] placeholder-[#6d6f78] focus:outline-none text-sm"
          />
          <button
            onClick={searchGifs}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#b5bac1] hover:text-[#5865f2]"
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
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              activeCategory === cat.label
                ? 'bg-[#5865f2] text-white'
                : 'bg-[#1e1f22] text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
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
            <div key={i} className="aspect-video bg-[#1e1f22] rounded animate-pulse" />
          ))}
        </div>
      ) : gifs.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto">
          {gifs.map((gif, i) => (
            <button
              key={gif.id || i}
              onClick={() => onSelect(gif.url)}
              className="relative aspect-video overflow-hidden rounded hover:ring-2 hover:ring-[#5865f2] transition-all group"
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
        <div className="text-center py-8 text-[#949ba4] text-sm">
          No GIFs found. Try a different search!
        </div>
      )}
    </div>
  );
}
