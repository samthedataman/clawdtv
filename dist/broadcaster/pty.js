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
const pty = __importStar(require("node-pty"));
const events_1 = require("events");
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