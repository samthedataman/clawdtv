import { EventEmitter } from 'events';
import { TerminalSize } from '../shared/types';

// Dynamic import for node-pty (optional dependency)
let pty: typeof import('node-pty') | null = null;
try {
  pty = require('node-pty');
} catch {
  // node-pty not available
}

export interface PtyEvents {
  data: (data: string) => void;
  exit: (code: number, signal?: number) => void;
  resize: (size: TerminalSize) => void;
}

export class PtyCapture extends EventEmitter {
  private ptyProcess: import('node-pty').IPty | null = null;
  private size: TerminalSize;
  private shell: string;

  constructor(shell?: string) {
    super();
    this.shell = shell || process.env.SHELL || '/bin/bash';
    this.size = {
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  }

  start(): void {
    if (!pty) {
      throw new Error(
        'node-pty is required for streaming but not installed.\n' +
        'To stream, you need build tools installed:\n' +
        '  macOS: xcode-select --install\n' +
        '  Ubuntu: sudo apt install build-essential python3\n' +
        '  Windows: npm install -g windows-build-tools\n' +
        'Then reinstall: npm install -g github:samthedataman/claude-tv'
      );
    }

    // Spawn PTY
    this.ptyProcess = pty.spawn(this.shell, [], {
      name: 'xterm-256color',
      cols: this.size.cols,
      rows: this.size.rows,
      cwd: process.cwd(),
      env: process.env as { [key: string]: string },
    });

    // Forward data
    this.ptyProcess.onData((data) => {
      this.emit('data', data);
    });

    // Handle exit
    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', exitCode, signal);
    });

    // Handle terminal resize
    process.stdout.on('resize', () => {
      this.handleResize();
    });
  }

  write(data: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.size = { cols, rows };
      this.ptyProcess.resize(cols, rows);
      this.emit('resize', this.size);
    }
  }

  private handleResize(): void {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    this.resize(cols, rows);
  }

  getSize(): TerminalSize {
    return { ...this.size };
  }

  kill(): void {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }

  getPid(): number | undefined {
    return this.ptyProcess?.pid;
  }
}
