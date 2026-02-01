"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const protocol_1 = require("../shared/protocol");
const config_1 = require("../shared/config");
class StreamClient extends events_1.EventEmitter {
    ws = null;
    options;
    heartbeatInterval = null;
    reconnectAttempts = 0;
    isClosing = false;
    roomId = null;
    constructor(options) {
        super();
        this.options = options;
    }
    connect() {
        this.isClosing = false;
        this.ws = new ws_1.default(this.options.serverUrl);
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
            this.emit('disconnected');
            if (!this.isClosing && this.reconnectAttempts < config_1.MAX_RECONNECT_ATTEMPTS) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), config_1.RECONNECT_DELAY);
            }
        });
        this.ws.on('error', (error) => {
            this.emit('error', error);
        });
    }
    authenticate() {
        this.send((0, protocol_1.createMessage)({
            type: 'auth',
            token: this.options.token,
            username: this.options.username,
            role: 'broadcaster',
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
                    this.createStream();
                }
                else {
                    this.emit('error', new Error(message.error || 'Authentication failed'));
                }
                break;
            case 'stream_created':
                this.roomId = message.roomId;
                this.emit('connected');
                this.emit('streamCreated', message.streamId, message.roomId);
                break;
            case 'chat':
            case 'action':
                this.emit('chat', message);
                break;
            case 'viewer_join':
                this.emit('viewerJoin', message.username, message.viewerCount);
                break;
            case 'viewer_leave':
                this.emit('viewerLeave', message.username, message.viewerCount);
                break;
            case 'mod_action':
                this.emit('modAction', message);
                break;
            case 'error':
                this.emit('error', new Error(message.message));
                break;
            case 'heartbeat_ack':
                // Heartbeat acknowledged
                break;
        }
    }
    createStream() {
        this.send((0, protocol_1.createMessage)({
            type: 'create_stream',
            title: this.options.title,
            isPrivate: this.options.isPrivate,
            password: this.options.password,
            maxViewers: this.options.maxViewers,
            terminalSize: this.options.terminalSize,
        }));
    }
    sendTerminalData(data) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.send((0, protocol_1.createMessage)({
                type: 'terminal',
                data,
            }));
        }
    }
    sendTerminalResize(size) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.send((0, protocol_1.createMessage)({
                type: 'terminal_resize',
                size,
            }));
        }
    }
    sendChat(content) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.send({
                type: 'send_chat',
                content,
                timestamp: Date.now(),
            });
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
    getRoomId() {
        return this.roomId;
    }
    close() {
        this.isClosing = true;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
exports.StreamClient = StreamClient;
//# sourceMappingURL=stream.js.map