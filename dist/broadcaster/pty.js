import { EventEmitter } from 'events';
import * as fs from 'fs';
// Dynamic import for node-pty (optional dependency)
let pty = null;
try {
    pty = require('node-pty');
}
catch {
    // node-pty not available
}
// Find a working shell
function findShell() {
    const shells = [
        process.env.SHELL,
        '/bin/zsh',
        '/bin/bash',
        '/bin/sh',
        '/usr/bin/zsh',
        '/usr/bin/bash',
        '/usr/bin/sh',
    ].filter(Boolean);
    for (const shell of shells) {
        try {
            if (fs.existsSync(shell)) {
                return shell;
            }
        }
        catch {
            // ignore
        }
    }
    return '/bin/sh';
}
export class PtyCapture extends EventEmitter {
    ptyProcess = null;
    size;
    shell;
    constructor(shell) {
        super();
        this.shell = shell || findShell();
        this.size = {
            cols: process.stdout.columns || 80,
            rows: process.stdout.rows || 24,
        };
    }
    start() {
        if (!pty) {
            throw new Error('node-pty is required for streaming but not installed.\n' +
                'To stream, you need build tools installed:\n' +
                '  macOS: xcode-select --install\n' +
                '  Ubuntu: sudo apt install build-essential python3\n' +
                '  Windows: npm install -g windows-build-tools\n' +
                'Then reinstall claude-tv');
        }
        try {
            // Spawn PTY with explicit shell path
            this.ptyProcess = pty.spawn(this.shell, [], {
                name: 'xterm-256color',
                cols: this.size.cols,
                rows: this.size.rows,
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    SHELL: this.shell,
                },
            });
        }
        catch (err) {
            throw new Error(`Failed to start terminal: ${err.message}\n\n` +
                `Shell: ${this.shell}\n` +
                `This usually means node-pty needs to be rebuilt for your Node version.\n\n` +
                `Try running:\n` +
                `  npm rebuild node-pty\n\n` +
                `Or reinstall with:\n` +
                `  npm uninstall -g claude-tv && npm install -g https://github.com/samthedataman/claude-tv/releases/download/v1.0.1/claude-tv-1.0.1.tgz`);
        }
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
    write(data) {
        if (this.ptyProcess) {
            this.ptyProcess.write(data);
        }
    }
    resize(cols, rows) {
        if (this.ptyProcess) {
            this.size = { cols, rows };
            this.ptyProcess.resize(cols, rows);
            this.emit('resize', this.size);
        }
    }
    handleResize() {
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;
        this.resize(cols, rows);
    }
    getSize() {
        return { ...this.size };
    }
    kill() {
        if (this.ptyProcess) {
            this.ptyProcess.kill();
            this.ptyProcess = null;
        }
    }
    getPid() {
        return this.ptyProcess?.pid;
    }
}
//# sourceMappingURL=pty.js.map