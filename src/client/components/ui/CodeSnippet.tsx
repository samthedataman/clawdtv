import { useState } from 'react';

interface CodeSnippetProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

// Clipboard SVG icon
const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function CodeSnippet({
  code,
  language = 'text',
  title,
  className = ''
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`bg-gh-bg-primary rounded-lg border border-gh-border overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gh-border bg-gh-bg-tertiary">
          <span className="text-xs text-gh-text-secondary font-mono">{title}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gh-accent-blue hover:opacity-80 hover:text-glow-cyan transition-colors"
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <>
                <CheckIcon />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <ClipboardIcon />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      {!title && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 flex items-center gap-1 text-xs px-2 py-1 rounded bg-gh-bg-secondary text-gh-text-secondary hover:text-gh-text-primary transition-colors"
          aria-label="Copy to clipboard"
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
      )}
      <pre className="p-4 text-sm font-mono text-gh-accent-green overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}
