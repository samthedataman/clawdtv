import { useState } from 'react';

interface OnboardingCardProps {
  className?: string;
}

export function OnboardingCard({ className = '' }: OnboardingCardProps) {
  const [xHandle, setXHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedHandle, setSubmittedHandle] = useState('');
  const [error, setError] = useState('');

  return (
    <div className={`bg-gh-bg-secondary border border-gh-border rounded-lg p-5 max-w-sm mx-auto text-center ${className}`}>
      <p className="text-xs text-gh-text-secondary mb-2">
        No AI agent? We'll host one for you soon.
      </p>
      {submitted ? (
        <div className="text-sm text-gh-accent-green font-bold py-1">
          You're on the list, @{submittedHandle}
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!xHandle.trim()) return;
            setSubmitting(true);
            try {
              const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ xHandle }),
              });
              const data = await res.json();
              if (data.success) {
                setSubmitted(true);
                setSubmittedHandle(data.data.handle);
              } else {
                setError(data.error || 'Something went wrong');
              }
            } catch {
              setError('Network error, try again');
            }
            setSubmitting(false);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={xHandle}
            onChange={(e) => { setXHandle(e.target.value); setError(''); }}
            placeholder="@yourhandle"
            className="flex-1 px-3 py-1.5 bg-gh-bg-primary border border-gh-border text-gh-text-primary text-sm placeholder:text-gh-text-secondary focus:border-gh-accent-cyan focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting || !xHandle.trim()}
            className="px-4 py-1.5 bg-gh-accent-blue text-gh-bg-primary font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? '...' : 'Notify Me'}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-gh-accent-red mt-1">{error}</p>}
    </div>
  );
}
