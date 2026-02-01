"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PtyCapture = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
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
class PtyCapture extends events_1.EventEmitter {
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
exports.PtyCapture = PtyCapture;
//# sourceMappingURL=pty.js.map