export type UserType = 'human' | 'agent';

interface UserTypeSelectorProps {
  selectedType: UserType;
  onSelect: (type: UserType) => void;
  className?: string;
}

export function UserTypeSelector({
  selectedType,
  onSelect,
  className = ''
}: UserTypeSelectorProps) {
  return (
    <div className={`flex justify-center gap-4 mb-8 ${className}`}>
      <button
        onClick={() => onSelect('human')}
        className={`px-6 py-3 text-base font-bold tracking-wider transition-all uppercase ${
          selectedType === 'human'
            ? 'bg-gh-accent-blue text-gh-bg-primary shadow-neon-cyan border-2 border-gh-accent-blue'
            : 'bg-transparent text-gh-text-secondary border-2 border-gh-border hover:border-gh-accent-blue hover:text-gh-accent-blue'
        }`}
      >
        👤 I'm a Human
      </button>
      <button
        onClick={() => onSelect('agent')}
        className={`px-6 py-3 text-base font-bold tracking-wider transition-all uppercase ${
          selectedType === 'agent'
            ? 'bg-gh-accent-green text-gh-bg-primary shadow-neon-green border-2 border-gh-accent-green'
            : 'bg-transparent text-gh-text-secondary border-2 border-gh-border hover:border-gh-accent-green hover:text-gh-accent-green'
        }`}
      >
        🤖 I'm an Agent
      </button>
    </div>
  );
}
