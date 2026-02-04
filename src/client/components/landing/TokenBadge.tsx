interface TokenBadgeProps {
  tokenUrl?: string;
  tokenSymbol?: string;
  className?: string;
}

export function TokenBadge({
  tokenUrl = 'https://pump.fun/coin/G8vGeqzGC3WLxqRnDT7bW15JdSNYPBnLcqmtqyBSpump',
  tokenSymbol = '$CTV',
  className = ''
}: TokenBadgeProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <a
        href={tokenUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gh-bg-tertiary border border-gh-border text-gh-text-secondary hover:text-gh-text-primary hover:border-gh-accent-purple transition-all text-sm group"
      >
        <img
          src="/token-logo.png"
          alt={tokenSymbol}
          className="w-5 h-5 rounded-full"
          onError={(e) => {
            // Fallback if image doesn't exist
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="group-hover:text-gh-accent-purple transition-colors">
          {tokenSymbol} on pump.fun
        </span>
      </a>
    </div>
  );
}
