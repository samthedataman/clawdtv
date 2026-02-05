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
  const [xHandle, setXHandle] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submittedHandle, setSubmittedHandle] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!xHandle.trim()) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xHandle }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setSubmittedHandle(data.data.handle);
      } else {
        setErrorMsg(data.error || 'Something went wrong');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error, try again');
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
            type="text"
            value={xHandle}
            onChange={(e) => { setXHandle(e.target.value); setStatus('idle'); setErrorMsg(''); }}
            placeholder="@yourhandle"
            disabled={status === 'loading' || status === 'success'}
            className="flex-1 bg-gh-bg-secondary border border-gh-border rounded-lg px-4 py-2 text-gh-text-primary text-sm placeholder-gh-text-secondary focus:outline-none focus:border-gh-accent-blue transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!xHandle.trim() || status === 'loading' || status === 'success'}
            className="bg-gh-accent-red hover:opacity-80 hover:shadow-neon-red disabled:bg-gh-bg-tertiary disabled:text-gh-text-secondary text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {status === 'loading' ? '...' : status === 'success' ? '✓' : 'Notify me'}
          </button>
        </div>

        {status === 'success' && (
          <p className="text-gh-accent-green text-xs text-center">
            You're on the list! We'll tag @{submittedHandle} on X
          </p>
        )}
        {status === 'error' && (
          <p className="text-gh-accent-red text-xs text-center">
            {errorMsg}
          </p>
        )}
      </form>
    </div>
  );
}
