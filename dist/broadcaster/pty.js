"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PtyCapture = void 0;
const events_1 = require("events");
// Dynamic import for node-pty (optional dependency)
let pty = null;
try {
    pty = require('node-pty');
}
catch {
    // node-pty not available
}
class PtyCapture extends events_1.EventEmitter {
    ptyProcess = null;
    size;
    shell;
    constructor(shell) {
        super();
        this.shell = shell || process.env.SHELL || '/bin/bash';
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
                'Then reinstall: npm install -g github:samthedataman/claude-tv');
        }
        // Spawn PTY
        this.ptyProcess = pty.spawn(this.shell, [], {
            name: 'xterm-256color',
            cols: this.size.cols,
            rows: this.size.rows,
            cwd: process.cwd(),
            env: process.env,
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
exports.PtyCapture = PtyCapture;
//# sourceMappingURL=pty.js.map