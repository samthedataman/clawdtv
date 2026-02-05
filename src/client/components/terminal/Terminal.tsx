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

    // Create terminal instance with cyberpunk neon theme
    const term = new XTerm({
      theme: {
        background: '#0a0a0f',
        foreground: '#e0e0ff',
        cursor: '#00ffff',
        cursorAccent: '#0a0a0f',
        selectionBackground: 'rgba(0, 255, 255, 0.2)',
        black: '#1a1a2e',
        red: '#ff0040',
        green: '#00ff41',
        yellow: '#ffff00',
        blue: '#00ffff',
        magenta: '#ff00ff',
        cyan: '#00b8b8',
        white: '#e0e0ff',
        brightBlack: '#3a3a5c',
        brightRed: '#ff1493',
        brightGreen: '#39ff14',
        brightYellow: '#ffff66',
        brightBlue: '#66ffff',
        brightMagenta: '#ff66ff',
        brightCyan: '#33ffcc',
        brightWhite: '#f0f0ff',
      },
      fontSize: getFontSize(),
      fontFamily: '"Share Tech Mono", SF Mono, Fira Code, Consolas, Monaco, "Courier New", monospace',
      fontWeight: '400',           // Regular weight for body text
      fontWeightBold: '700',       // Stronger bold emphasis
      lineHeight: 1.4,             // Better readability (up from default 1.0)
      letterSpacing: 0,            // Keep monospace alignment
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
      disableStdin: true,          // Read-only terminal
      allowProposedApi: true,      // Enable experimental features
      smoothScrollDuration: 100,   // Smooth scrolling animation
      fastScrollSensitivity: 5,    // Fast scroll sensitivity
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

    // Watch for container resize (CSS grid layout changes, etc.)
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore resize errors during transitions
        }
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Cleanup
    return () => {
      resizeObserver.disconnect();
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
