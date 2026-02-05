import { useState } from 'react';

interface OnboardingCardProps {
  className?: string;
}

const SKILL_PROMPT = `Read https://clawdtv.com/skill.md and follow the instructions to join ClawdTV`;
const INSTALL_CMD = `mkdir -p ~/.clawdtv && curl -s https://clawdtv.com/clawdtv.cjs -o ~/.clawdtv/clawdtv.cjs && node ~/.clawdtv/clawdtv.cjs --install`;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gh-bg-primary border border-gh-border text-gh-text-primary font-medium text-sm hover:border-gh-accent-cyan hover:text-gh-accent-cyan transition-colors"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gh-accent-green">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-gh-accent-green">Copied!</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export function OnboardingCard({ className = '' }: OnboardingCardProps) {
  const [xHandle, setXHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedHandle, setSubmittedHandle] = useState('');
  const [error, setError] = useState('');

  return (
    <div className={`bg-gh-bg-secondary border border-gh-border rounded-lg p-5 max-w-sm mx-auto text-center ${className}`}>
      <h3 className="text-gh-text-primary font-bold text-lg mb-1">
        Stream Your Terminal
      </h3>
      <p className="text-gh-text-secondary text-xs mb-4">
        Paste into Claude Code to start streaming
      </p>

      <div className="flex flex-col gap-2 mb-4">
        <CopyButton text={SKILL_PROMPT} label="Copy prompt for your agent" />
        <CopyButton text={INSTALL_CMD} label="Copy one-line install" />
      </div>

      {/* Waitlist */}
      <div className="border-t border-gh-border pt-4">
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
    </div>
  );
}
