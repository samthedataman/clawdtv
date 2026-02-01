"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcasterChat = exports.StreamClient = exports.PtyCapture = exports.Broadcaster = void 0;
const pty_1 = require("./pty");
const stream_1 = require("./stream");
const chat_1 = require("./chat");
const config_1 = require("../shared/config");
const ascii_1 = require("../shared/ascii");
class Broadcaster {
    pty;
    stream;
    chat;
    options;
    isRunning = false;
    constructor(options) {
        this.options = options;
        // Initialize PTY
        this.pty = new pty_1.PtyCapture();
        // Initialize chat
        this.chat = new chat_1.BroadcasterChat({
            enabled: options.showChat,
        });
        // Get WebSocket URL
        const { ws: wsUrl } = (0, config_1.parseServerUrl)(options.serverUrl);
        // Initialize stream client
        const streamOptions = {
            serverUrl: `${wsUrl}/ws`,
            token: options.token,
            username: options.username,
            title: options.title,
            isPrivate: options.isPrivate,
            password: options.password,
            maxViewers: options.maxViewers,
            terminalSize: this.pty.getSize(),
        };
        this.stream = new stream_1.StreamClient(streamOptions);
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        // PTY events
        this.pty.on('data', (data) => {
            // Write to local terminal
            process.stdout.write(data);
            // Send to stream
            this.stream.sendTerminalData(data);
        });
        this.pty.on('resize', (size) => {
            this.stream.sendTerminalResize(size);
        });
        this.pty.on('exit', (code) => {
            console.log(`\nShell exited with code ${code}`);
            this.stop();
        });
        // Stream events
        this.stream.on('connected', () => {
            // Already handled by streamCreated
        });
        this.stream.on('streamCreated', (streamId, roomId) => {
            console.clear();
            console.log(ascii_1.LOGO);
            console.log((0, ascii_1.STREAM_STARTED)(roomId, this.options.title));
            console.log(ascii_1.WELCOME_STREAMER);
            console.log('\n\x1b[90m─────────────────────────────────────────────────────────────────────\x1b[0m\n');
        });
        this.stream.on('chat', (message) => {
            this.chat.handleChatMessage(message);
        });
        this.stream.on('viewerJoin', (username, count) => {
            this.chat.handleViewerJoin(username, count);
        });
        this.stream.on('viewerLeave', (username, count) => {
            this.chat.handleViewerLeave(username, count);
        });
        this.stream.on('modAction', (action) => {
            this.chat.handleModAction(action);
        });
        this.stream.on('disconnected', () => {
            if (this.isRunning) {
                console.log('\n\x1b[33mDisconnected from server. Attempting to reconnect...\x1b[0m');
            }
        });
        this.stream.on('error', (error) => {
            console.error(`\n\x1b[31mStream error: ${error.message}\x1b[0m`);
        });
        // Chat overlay handler
        if (this.options.showChat) {
            this.chat.setMessageHandler((formatted) => {
                // Save cursor, move to top, print message, restore cursor
                process.stdout.write(`\x1b7\x1b[1;1H\x1b[2K${formatted}\x1b8`);
            });
        }
    }
    async start() {
        this.isRunning = true;
        // Put terminal in raw mode
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        // Forward input to PTY
        process.stdin.on('data', (data) => {
            this.pty.write(data.toString());
        });
        // Connect to server
        console.log(`Connecting to ${this.options.serverUrl}...`);
        this.stream.connect();
        // Start PTY
        this.pty.start();
    }
    stop() {
        this.isRunning = false;
        // Restore terminal
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        this.pty.kill();
        this.stream.close();
        console.log(ascii_1.GOODBYE);
        process.exit(0);
    }
    sendChat(message) {
        this.stream.sendChat(message);
    }
    getViewerCount() {
        return this.chat.getViewerCount();
    }
    getRoomId() {
        return this.stream.getRoomId();
    }
}
exports.Broadcaster = Broadcaster;
var pty_2 = require("./pty");
Object.defineProperty(exports, "PtyCapture", { enumerable: true, get: function () { return pty_2.PtyCapture; } });
var stream_2 = require("./stream");
Object.defineProperty(exports, "StreamClient", { enumerable: true, get: function () { return stream_2.StreamClient; } });
var chat_2 = require("./chat");
Object.defineProperty(exports, "BroadcasterChat", { enumerable: true, get: function () { return chat_2.BroadcasterChat; } });
//# sourceMappingURL=index.js.map