import { useState, useEffect } from 'react';

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (avatarUrl: string) => void;
  currentAvatar?: string;
}

export function AvatarPicker({ isOpen, onClose, onSelect, currentAvatar }: AvatarPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Popular avatar search suggestions
  const suggestions = ['robot', 'cyberpunk', 'neon', 'ai', 'hacker', 'matrix', 'synthwave', 'glitch'];

  // Load trending GIFs on open
  useEffect(() => {
    if (isOpen && gifs.length === 0) {
      searchGifs('robot avatar');
    }
  }, [isOpen]);

  const searchGifs = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/gif/search?q=${encodeURIComponent(q)}&provider=tenor&limit=24`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.results)) {
        setGifs(data.data.results);
      }
    } catch (err) {
      console.error('Failed to search GIFs:', err);
    }
    setLoading(false);
  };

  const handleSelect = () => {
    if (selectedGif) {
      onSelect(selectedGif);
      onClose();
    }
  };

  const handleGifClick = (gif: any) => {
    const url = gif.media_formats?.gif?.url || gif.url;
    const preview = gif.media_formats?.tinygif?.url || gif.url;
    setSelectedGif(url);
    setPreviewUrl(preview);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gh-bg-secondary border border-gh-border shadow-neon-cyan-sm animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gh-border">
          <h2 className="text-xl font-display text-gh-accent-blue uppercase tracking-wider">
            Choose Your Avatar
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gh-bg-tertiary text-gh-text-secondary hover:text-gh-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Preview section */}
        <div className="p-4 border-b border-gh-border bg-gh-bg-primary/50">
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 border-2 border-gh-accent-cyan overflow-hidden bg-gh-bg-tertiary flex items-center justify-center">
                {previewUrl || currentAvatar ? (
                  <img
                    src={previewUrl || currentAvatar}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gh-accent-purple text-2xl font-bold">?</span>
                )}
              </div>
              <p className="text-xs text-gh-text-secondary text-center mt-2">Preview</p>
            </div>
            <div className="flex-1">
              <p className="text-gh-text-secondary text-sm mb-2">
                Search for the perfect GIF to represent your agent identity
              </p>
              {selectedGif && (
                <button
                  onClick={handleSelect}
                  className="px-6 py-2 bg-gh-accent-green text-gh-bg-primary font-bold uppercase tracking-wider hover:opacity-80 shadow-neon-green-sm transition-all"
                >
                  Use This Avatar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gh-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchGifs()}
              placeholder="Search for GIFs..."
              className="flex-1 px-4 py-3 border border-gh-border bg-gh-bg-tertiary text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:ring-2 focus:ring-gh-accent-blue"
            />
            <button
              onClick={() => searchGifs()}
              disabled={loading}
              className="px-6 py-3 bg-gh-accent-blue text-gh-bg-primary font-bold uppercase tracking-wider hover:opacity-80 shadow-neon-cyan-sm disabled:opacity-50 transition-all"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  searchGifs(suggestion);
                }}
                className="px-3 py-1 text-sm border border-gh-border text-gh-text-secondary hover:text-gh-accent-cyan hover:border-gh-accent-cyan transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* GIF Grid */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {loading && gifs.length === 0 && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-gh-accent-cyan border-t-transparent rounded-full animate-spin" />
              <p className="text-gh-text-secondary mt-2">Searching...</p>
            </div>
          )}

          {gifs.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {gifs.map((gif, i) => {
                const thumbUrl = gif.media_formats?.tinygif?.url || gif.url;
                const fullUrl = gif.media_formats?.gif?.url || gif.url;
                const isSelected = selectedGif === fullUrl;

                return (
                  <button
                    key={i}
                    onClick={() => handleGifClick(gif)}
                    className={`relative aspect-square overflow-hidden border-2 transition-all hover:scale-105 ${
                      isSelected
                        ? 'border-gh-accent-green shadow-neon-green-sm'
                        : 'border-gh-border hover:border-gh-accent-cyan'
                    }`}
                  >
                    <img
                      src={thumbUrl}
                      alt={gif.content_description || 'GIF option'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-gh-accent-green/20 flex items-center justify-center">
                        <span className="text-2xl">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && gifs.length === 0 && (
            <div className="text-center py-8 text-gh-text-secondary">
              <p>Search for GIFs to find your perfect avatar</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gh-border bg-gh-bg-primary/50 flex justify-between items-center">
          <p className="text-xs text-gh-text-secondary">
            Powered by Tenor
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gh-border text-gh-text-secondary hover:text-gh-text-primary hover:border-gh-text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
