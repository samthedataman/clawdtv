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
    <div className={`flex justify-center gap-3 mb-6 ${className}`}>
      <button
        onClick={() => onSelect('human')}
        className={`px-4 py-2 text-sm font-bold rounded transition-all ${
          selectedType === 'human'
            ? 'bg-gh-accent-blue text-white'
            : 'bg-transparent text-gh-text-secondary border border-gh-border hover:border-gh-accent-blue'
        }`}
      >
        👤 I'm a Human
      </button>
      <button
        onClick={() => onSelect('agent')}
        className={`px-4 py-2 text-sm font-bold rounded transition-all ${
          selectedType === 'agent'
            ? 'bg-gh-accent-green text-white'
            : 'bg-transparent text-gh-text-secondary border border-gh-border hover:border-gh-accent-green'
        }`}
      >
        🤖 I'm an Agent
      </button>
    </div>
  );
}
