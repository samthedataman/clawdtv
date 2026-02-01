"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeScreen = exports.MultiStreamClient = exports.MultiViewerUI = exports.InputHandler = exports.ChatView = exports.TerminalView = exports.ViewerUI = exports.MultiViewer = exports.Viewer = void 0;
const ws_1 = __importDefault(require("ws"));
const ui_1 = require("./ui");
const multi_ui_1 = require("./multi-ui");
const multi_stream_1 = require("./multi-stream");
const protocol_1 = require("../shared/protocol");
const config_1 = require("../shared/config");
// Single stream viewer (original)
class Viewer {
    ws = null;
    ui;
    options;
    heartbeatInterval = null;
    reconnectAttempts = 0;
    isClosing = false;
    constructor(options) {
        this.options = options;
        const uiOptions = {
            showChat: options.showChat,
            fullscreen: options.fullscreen,
            onSendMessage: (message) => this.sendChat(message),
            onQuit: () => this.close(),
        };
        this.ui = new ui_1.ViewerUI(uiOptions);
    }
    connect() {
        this.isClosing = false;
        const { ws: wsUrl } = (0, config_1.parseServerUrl)(this.options.serverUrl);
        this.ui.showConnecting();
        this.ws = new ws_1.default(`${wsUrl}/ws`);
        this.ws.on('open', () => {
            this.reconnectAttempts = 0;
            this.authenticate();
            this.startHeartbeat();
        });
        this.ws.on('message', (data) => {
            this.handleMessage(data.toString());
        });
        this.ws.on('close', () => {
            this.stopHeartbeat();
            this.ui.showDisconnected();
            if (!this.isClosing && this.reconnectAttempts < config_1.MAX_RECONNECT_ATTEMPTS) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), config_1.RECONNECT_DELAY);
            }
        });
        this.ws.on('error', (error) => {
            this.ui.showError(error.message);
        });
    }
    authenticate() {
        this.send((0, protocol_1.createMessage)({
            type: 'auth',
            token: this.options.token,
            username: this.options.username,
            role: 'viewer',
            roomId: this.options.roomId,
        }));
    }
    handleMessage(data) {
        let message;
        try {
            message = JSON.parse(data);
        }
        catch {
            return;
        }
        switch (message.type) {
            case 'auth_response':
                if (message.success) {
                    this.joinStream();
                }
                else {
                    this.ui.showError(message.error || 'Authentication failed');
                }
                break;
            case 'join_stream_response':
                if (message.success && message.stream) {
                    this.ui.showConnected();
                    this.ui.setStreamInfo(message.stream.title, message.stream.broadcaster, message.stream.viewerCount);
                    this.ui.setTerminalSize(message.stream.terminalSize);
                    if (message.recentMessages) {
                        this.ui.loadRecentMessages(message.recentMessages);
                    }
                }
                else {
                    this.ui.showError(message.error || 'Failed to join stream');
                }
                break;
            case 'terminal':
                this.ui.handleTerminalData(message);
                break;
            case 'terminal_resize':
                this.ui.handleTerminalResize(message);
                break;
            case 'chat':
            case 'action':
                this.ui.handleChatMessage(message);
                break;
            case 'system':
                this.ui.handleSystemMessage(message);
                break;
            case 'mod_action':
                this.ui.handleModAction(message);
                break;
            case 'viewer_join':
                this.ui.handleViewerJoin(message);
                break;
            case 'viewer_leave':
                this.ui.handleViewerLeave(message);
                break;
            case 'stream_end':
                this.ui.handleStreamEnd(message);
                break;
            case 'error':
                this.ui.showError(message.message);
                break;
            case 'heartbeat_ack':
                // Heartbeat acknowledged
                break;
        }
    }
    joinStream() {
        this.send((0, protocol_1.createMessage)({
            type: 'join_stream',
            roomId: this.options.roomId,
            password: this.options.password,
        }));
    }
    sendChat(content) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.send((0, protocol_1.createMessage)({
                type: 'send_chat',
                content,
            }));
        }
    }
    send(message) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.send((0, protocol_1.createMessage)({ type: 'heartbeat' }));
        }, config_1.HEARTBEAT_INTERVAL);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    close() {
        this.isClosing = true;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.ui.destroy();
        process.exit(0);
    }
}
exports.Viewer = Viewer;
// Multi-stream viewer (new)
class MultiViewer {
    client;
    ui;
    options;
    constructor(options) {
        this.options = options;
        // Create UI
        this.ui = new multi_ui_1.MultiViewerUI({
            roomIds: options.roomIds,
            showChat: options.showChat,
            onSendMessage: (index, message) => this.client.sendChat(index, message),
            onQuit: () => this.close(),
        });
        // Create multi-stream client
        this.client = new multi_stream_1.MultiStreamClient({
            serverUrl: options.serverUrl,
            token: options.token,
            username: options.username,
            roomIds: options.roomIds,
            passwords: options.passwords,
            onTerminalData: (index, data) => this.ui.appendTerminalData(index, data),
            onChatMessage: (index, message) => this.ui.addChatMessage(index, message),
            onStreamInfo: (index, info) => {
                if (info) {
                    this.ui.setStreamInfo(index, info.title, info.broadcaster, info.viewerCount);
                }
            },
            onViewerCount: (index, count) => this.ui.setViewerCount(index, count),
            onStreamEnd: (index, reason) => this.ui.setStreamEnded(index, reason),
            onError: (index, error) => this.ui.setError(index, error),
            onConnect: (index) => this.ui.setConnected(index),
            onDisconnect: (index) => this.ui.setDisconnected(index),
        });
    }
    connect() {
        this.client.connect();
    }
    close() {
        this.client.close();
        this.ui.destroy();
        process.exit(0);
    }
}
exports.MultiViewer = MultiViewer;
var ui_2 = require("./ui");
Object.defineProperty(exports, "ViewerUI", { enumerable: true, get: function () { return ui_2.ViewerUI; } });
var terminal_view_1 = require("./terminal-view");
Object.defineProperty(exports, "TerminalView", { enumerable: true, get: function () { return terminal_view_1.TerminalView; } });
var chat_view_1 = require("./chat-view");
Object.defineProperty(exports, "ChatView", { enumerable: true, get: function () { return chat_view_1.ChatView; } });
var input_1 = require("./input");
Object.defineProperty(exports, "InputHandler", { enumerable: true, get: function () { return input_1.InputHandler; } });
var multi_ui_2 = require("./multi-ui");
Object.defineProperty(exports, "MultiViewerUI", { enumerable: true, get: function () { return multi_ui_2.MultiViewerUI; } });
var multi_stream_2 = require("./multi-stream");
Object.defineProperty(exports, "MultiStreamClient", { enumerable: true, get: function () { return multi_stream_2.MultiStreamClient; } });
var home_1 = require("./home");
Object.defineProperty(exports, "HomeScreen", { enumerable: true, get: function () { return home_1.HomeScreen; } });
//# sourceMappingURL=index.js.map