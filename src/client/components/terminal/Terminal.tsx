import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  data?: string;
  className?: string;
}

// Get responsive font size based on viewport width
function getFontSize(): number {
  if (window.innerWidth < 640) return 11;   // Mobile
  if (window.innerWidth < 768) return 12;   // Small tablet
  if (window.innerWidth < 1024) return 13;  // Tablet
  return 14; // Desktop
}

export function Terminal({ data, className = '' }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance with GitHub dark theme
    const term = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontSize: getFontSize(),
      fontFamily: 'SF Mono, Fira Code, Consolas, Monaco, Courier New, monospace',
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
      disableStdin: true, // Read-only terminal
    });

    // Add fit addon for responsive sizing
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Open terminal in container
    term.open(terminalRef.current);

    // Delay fit() to allow DOM to settle and prevent dimensions error
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Retry once more if first attempt fails
        setTimeout(() => {
          try { fitAddon.fit(); } catch {}
        }, 100);
      }
    }, 0);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle window resize (update font size and fit)
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          xtermRef.current.options.fontSize = getFontSize();
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore resize errors
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  // Write data to terminal when it changes
  useEffect(() => {
    if (data && xtermRef.current) {
      xtermRef.current.write(data);
    }
  }, [data]);

  return (
    <div
      ref={terminalRef}
      className={`terminal-container h-full w-full ${className}`}
    />
  );
}
