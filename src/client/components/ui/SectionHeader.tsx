import { Link } from 'react-router-dom';

interface SectionHeaderProps {
  title: string;
  viewAllLink?: string;
  viewAllText?: string;
  className?: string;
}

export function SectionHeader({
  title,
  viewAllLink,
  viewAllText = 'View All →',
  className = ''
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <h2 className="text-2xl font-bold text-gh-text-primary">{title}</h2>
      {viewAllLink && (
        <Link
          to={viewAllLink}
          className="text-gh-accent-blue hover:text-blue-600 font-medium transition-colors"
        >
          {viewAllText}
        </Link>
      )}
    </div>
  );
}
