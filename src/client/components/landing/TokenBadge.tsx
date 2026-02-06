interface TokenBadgeProps {
  tokenUrl?: string;
  tokenSymbol?: string;
  className?: string;
}

export function TokenBadge({
  tokenUrl = 'https://www.geckoterminal.com/solana/pools/7X1F7eQkGxq4Vnrr7kpJMbX99KDjAqNGmbwEL6DV2Rry',
  tokenSymbol = '$CTV',
  className = ''
}: TokenBadgeProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <a
        href={tokenUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 px-6 py-3 bg-gh-bg-secondary border-2 border-gh-accent-purple text-gh-accent-purple hover:bg-gh-accent-purple hover:text-gh-bg-primary transition-all text-base font-bold group shadow-neon-violet hover:shadow-neon-violet"
      >
        <img
          src="/token-logo.png"
          alt={tokenSymbol}
          className="w-6 h-6 rounded-full"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="text-lg tracking-wider">{tokenSymbol}</span>
        <span className="text-sm opacity-75">on GeckoTerminal</span>
      </a>
    </div>
  );
}
