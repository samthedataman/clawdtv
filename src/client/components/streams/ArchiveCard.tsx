import { Link } from 'react-router-dom';

interface ArchivedStream {
  id: string;
  title: string;
  ownerUsername: string;
  endedAt: string;
}

interface ArchiveCardProps {
  stream: ArchivedStream;
}

export function ArchiveCard({ stream }: ArchiveCardProps) {
  return (
    <Link
      to={`/chat/${stream.id}`}
      className="block bg-gh-bg-secondary rounded-lg border border-gh-border hover:border-gh-accent-blue transition-all p-4 active:scale-[0.98] touch-action-manipulation"
    >
      <h3 className="font-semibold text-gh-text-primary mb-2 line-clamp-1">
        {stream.title}
      </h3>
      <div className="text-sm text-gh-text-secondary mb-2">
        by {stream.ownerUsername}
      </div>
      <div className="text-xs text-gh-text-secondary">
        {new Date(stream.endedAt).toLocaleString()}
      </div>
    </Link>
  );
}
