import { useEffect } from 'react';
import { Terminal } from './Terminal';
import { useTerminalStore } from '../../store/terminalStore';

interface TerminalModalProps {
  terminalBuffer: string;
}

export function TerminalModal({ terminalBuffer }: TerminalModalProps) {
  const { isOpen, close } = useTerminalStore();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      {/* Backdrop - click to close */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={close}
      />

      {/* Terminal panel */}
      <div className="relative w-full md:w-2/3 lg:w-1/2 h-2/3 bg-[#0a0a0f] border border-gh-border shadow-2xl pointer-events-auto flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#0d0d14] border-b border-gh-border/50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gh-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="18" rx="2" strokeWidth="2" />
              <path strokeWidth="2" strokeLinecap="round" d="M8 9l3 3-3 3M14 15h4" />
            </svg>
            <span className="text-sm font-semibold text-gh-text-primary">Terminal Output</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gh-text-secondary">ESC to close</span>
            <button
              onClick={close}
              className="w-6 h-6 flex items-center justify-center text-gh-text-secondary hover:text-gh-accent-red hover:bg-gh-accent-red/10 rounded transition-colors"
              title="Close terminal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Terminal content */}
        <div className="flex-1 min-h-0">
          {terminalBuffer ? (
            <Terminal data={terminalBuffer} />
          ) : (
            <div className="flex items-center justify-center h-full text-gh-text-secondary">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="18" rx="2" strokeWidth="1.5" />
                  <path strokeWidth="1.5" strokeLinecap="round" d="M8 9l3 3-3 3M14 15h4" />
                </svg>
                <p className="text-sm">No terminal output yet</p>
                <p className="text-xs opacity-60 mt-1">Terminal data will appear here</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#0d0d14] border-t border-gh-border/50 flex items-center justify-between">
          <span className="text-xs text-gh-text-secondary/60">
            {terminalBuffer ? `${(terminalBuffer.length / 1024).toFixed(1)} KB` : '0 KB'}
          </span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gh-accent-green animate-pulse" />
            <span className="text-xs text-gh-accent-green">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toggle button component for headers
export function TerminalToggleButton() {
  const { isOpen, toggle } = useTerminalStore();

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
        isOpen
          ? 'bg-gh-accent-green/20 text-gh-accent-green'
          : 'text-gh-text-secondary hover:text-gh-text-primary hover:bg-gh-bg-tertiary'
      }`}
      title={isOpen ? 'Hide terminal' : 'Show terminal'}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="18" rx="2" strokeWidth="2" />
        <path strokeWidth="2" strokeLinecap="round" d="M8 9l3 3-3 3M14 15h4" />
      </svg>
      <span className="hidden sm:inline">Terminal</span>
    </button>
  );
}
