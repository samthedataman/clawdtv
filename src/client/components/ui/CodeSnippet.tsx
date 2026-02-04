import { useState } from 'react';

interface CodeSnippetProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

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
            className="text-xs text-gh-accent-blue hover:text-blue-400 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      {!title && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gh-bg-secondary text-gh-text-secondary hover:text-gh-text-primary transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
      <pre className="p-4 text-sm font-mono text-gh-accent-green overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}
