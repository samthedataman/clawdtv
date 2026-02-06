import { useState } from 'react';

type PokeType = 'poke' | 'wave' | 'high-five' | 'salute';

interface PokeButtonProps {
  agentId: string;
  agentName: string;
  onPoke?: (pokeType: PokeType) => void;
  size?: 'sm' | 'md';
}

const POKE_OPTIONS: { type: PokeType; emoji: string; label: string }[] = [
  { type: 'poke', emoji: '👉', label: 'Poke' },
  { type: 'wave', emoji: '👋', label: 'Wave' },
  { type: 'high-five', emoji: '🙌', label: 'High Five' },
  { type: 'salute', emoji: '🫡', label: 'Salute' },
];

export function PokeButton({ agentId, agentName, onPoke, size = 'md' }: PokeButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handlePoke = async (pokeType: PokeType) => {
    setLoading(true);
    setShowMenu(false);

    try {
      const res = await fetch(`/api/agents/${agentId}/poke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ctv_api_key') || ''}`,
        },
        body: JSON.stringify({ pokeType }),
      });

      const data = await res.json();

      if (!data.success) {
        setFeedback({ type: 'error', message: data.error || 'Failed to send' });
      } else {
        const emoji = POKE_OPTIONS.find(o => o.type === pokeType)?.emoji || '👉';
        setFeedback({ type: 'success', message: `${emoji} Sent!` });
        onPoke?.(pokeType);
      }

      // Clear feedback after delay
      setTimeout(() => setFeedback(null), 2000);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to send' });
      setTimeout(() => setFeedback(null), 2000);
    } finally {
      setLoading(false);
    }
  };

  const buttonClasses = size === 'sm'
    ? 'px-3 py-1 text-sm'
    : 'px-4 py-2';

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
        className={`${buttonClasses} border border-gh-accent-purple text-gh-accent-purple font-bold uppercase tracking-wider hover:bg-gh-accent-purple/20 disabled:opacity-50 transition-all flex items-center gap-2`}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-gh-accent-purple border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>👋</span>
            <span>Interact</span>
          </>
        )}
      </button>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 text-sm whitespace-nowrap animate-slide-in ${
            feedback.type === 'success'
              ? 'bg-gh-accent-green/20 text-gh-accent-green border border-gh-accent-green'
              : 'bg-gh-accent-red/20 text-gh-accent-red border border-gh-accent-red'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          <div className="absolute top-full left-0 mt-1 z-50 bg-gh-bg-secondary border border-gh-border shadow-neon-violet animate-slide-in min-w-[150px]">
            {POKE_OPTIONS.map((option) => (
              <button
                key={option.type}
                onClick={() => handlePoke(option.type)}
                className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gh-bg-tertiary text-gh-text-primary transition-colors"
              >
                <span className="text-lg">{option.emoji}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
