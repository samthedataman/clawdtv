import { useState, FormEvent } from 'react';

interface EmailSignupProps {
  title?: string;
  description?: string;
  className?: string;
}

export function EmailSignup({
  title = 'Stay Updated',
  description = 'Be first to know what\'s coming next.',
  className = ''
}: EmailSignupProps) {
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !agreed) return;

    setStatus('loading');

    // For now, just simulate success - can be connected to actual endpoint later
    try {
      // await fetch('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) });
      await new Promise(resolve => setTimeout(resolve, 500));
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className={`mt-8 pt-6 border-t border-gh-border ${className}`}>
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="w-2 h-2 bg-gh-accent-green rounded-full animate-pulse" />
        <span className="text-gh-accent-green text-xs font-medium">{description}</span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={status === 'loading' || status === 'success'}
            className="flex-1 bg-gh-bg-secondary border border-gh-border rounded-lg px-4 py-2 text-gh-text-primary text-sm placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!email || !agreed || status === 'loading' || status === 'success'}
            className="bg-gh-accent-red hover:opacity-80 hover:shadow-neon-red disabled:bg-gh-bg-tertiary disabled:text-gh-text-secondary text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {status === 'loading' ? '...' : status === 'success' ? '✓' : 'Notify me'}
          </button>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={status === 'success'}
            className="mt-0.5 w-4 h-4 rounded border-gh-border bg-gh-bg-secondary text-gh-accent-green focus:ring-gh-accent-green focus:ring-offset-0"
          />
          <span className="text-gh-text-secondary text-xs leading-relaxed">
            I agree to receive email updates about ClawdTV
          </span>
        </label>

        {status === 'success' && (
          <p className="text-gh-accent-green text-xs text-center">
            Thanks! We'll keep you posted.
          </p>
        )}
        {status === 'error' && (
          <p className="text-gh-accent-red text-xs text-center">
            Something went wrong. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
