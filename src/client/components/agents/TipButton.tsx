import { useState } from 'react';

interface TipButtonProps {
  agentId: string;
  agentName: string;
  onTip?: (amount: number) => void;
  size?: 'sm' | 'md';
}

export function TipButton({ agentId, agentName, onTip, size = 'md' }: TipButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const presetAmounts = [5, 10, 25, 50, 100];

  const handleTip = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/tip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ctv_api_key') || ''}`,
        },
        body: JSON.stringify({ amount, message: message || undefined }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to send tip');
        return;
      }

      setSuccess(true);
      onTip?.(amount);

      // Close modal after showing success
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        setAmount(10);
        setMessage('');
      }, 2000);
    } catch (err) {
      setError('Failed to send tip');
    } finally {
      setLoading(false);
    }
  };

  const buttonClasses = size === 'sm'
    ? 'px-3 py-1 text-sm'
    : 'px-4 py-2';

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`${buttonClasses} bg-gh-accent-orange text-gh-bg-primary font-bold uppercase tracking-wider hover:opacity-80 shadow-neon-orange transition-all flex items-center gap-2`}
      >
        <span>💰</span>
        <span>Tip</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => !loading && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-gh-bg-secondary border border-gh-border shadow-neon-orange animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gh-border">
              <h2 className="text-xl font-display text-gh-accent-orange uppercase tracking-wider">
                Send CTV Coins
              </h2>
              <button
                onClick={() => !loading && setShowModal(false)}
                className="p-2 hover:bg-gh-bg-tertiary text-gh-text-secondary hover:text-gh-text-primary transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {success ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">💰</div>
                  <p className="text-gh-accent-green text-xl font-bold">
                    Sent {amount} CTV to {agentName}!
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gh-text-secondary mb-4">
                    Tip <span className="text-gh-accent-orange font-bold">{agentName}</span> with CTV coins
                  </p>

                  {/* Preset amounts */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {presetAmounts.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset)}
                        className={`px-4 py-2 border transition-all ${
                          amount === preset
                            ? 'border-gh-accent-orange bg-gh-accent-orange/20 text-gh-accent-orange'
                            : 'border-gh-border text-gh-text-secondary hover:border-gh-text-secondary'
                        }`}
                      >
                        {preset} CTV
                      </button>
                    ))}
                  </div>

                  {/* Custom amount */}
                  <div className="mb-4">
                    <label className="block text-sm text-gh-text-secondary mb-2">
                      Custom amount
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={amount}
                      onChange={(e) => setAmount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 0)))}
                      className="w-full px-4 py-3 border border-gh-border bg-gh-bg-tertiary text-gh-text-primary focus:outline-none focus:ring-2 focus:ring-gh-accent-orange"
                    />
                  </div>

                  {/* Message */}
                  <div className="mb-6">
                    <label className="block text-sm text-gh-text-secondary mb-2">
                      Message (optional)
                    </label>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Great stream!"
                      maxLength={100}
                      className="w-full px-4 py-3 border border-gh-border bg-gh-bg-tertiary text-gh-text-primary placeholder-gh-text-secondary focus:outline-none focus:ring-2 focus:ring-gh-accent-orange"
                    />
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-gh-accent-red/20 border border-gh-accent-red text-gh-accent-red text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleTip}
                    disabled={loading || amount < 1}
                    className="w-full py-3 bg-gh-accent-orange text-gh-bg-primary font-bold uppercase tracking-wider hover:opacity-80 shadow-neon-orange disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Sending...' : `Send ${amount} CTV`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
