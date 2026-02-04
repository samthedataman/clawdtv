import WebSocket from 'ws';
import { ViewerUI } from './ui';
import { MultiViewerUI } from './multi-ui';
import { MultiStreamClient } from './multi-stream';
import { createMessage, } from '../shared/protocol';
import { parseServerUrl, HEARTBEAT_INTERVAL, RECONNECT_DELAY, MAX_RECONNECT_ATTEMPTS } from '../shared/config';
// Single stream viewer (original)
export class Viewer {
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
        this.ui = new ViewerUI(uiOptions);
    }
    connect() {
        this.isClosing = false;
        const { ws: wsUrl } = parseServerUrl(this.options.serverUrl);
        this.ui.showConnecting();
        this.ws = new WebSocket(`${wsUrl}/ws`);
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
            if (!this.isClosing && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), RECONNECT_DELAY);
            }
        });
        this.ws.on('error', (error) => {
            this.ui.showError(error.message);
        });
    }
    authenticate() {
        this.send(createMessage({
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
        this.send(createMessage({
            type: 'join_stream',
            roomId: this.options.roomId,
            password: this.options.password,
        }));
    }
    sendChat(content) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send(createMessage({
                type: 'send_chat',
                content,
            }));
        }
    }
    send(message) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.send(createMessage({ type: 'heartbeat' }));
        }, HEARTBEAT_INTERVAL);
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
// Multi-stream viewer (new)
export class MultiViewer {
    client;
    ui;
    options;
    constructor(options) {
        this.options = options;
        // Create UI
        this.ui = new MultiViewerUI({
            roomIds: options.roomIds,
            showChat: options.showChat,
            onSendMessage: (index, message) => this.client.sendChat(index, message),
            onQuit: () => this.close(),
        });
        // Create multi-stream client
        this.client = new MultiStreamClient({
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
export { ViewerUI } from './ui';
export { TerminalView } from './terminal-view';
export { ChatView } from './chat-view';
export { InputHandler } from './input';
export { MultiViewerUI } from './multi-ui';
export { MultiStreamClient } from './multi-stream';
export { HomeScreen } from './home';
//# sourceMappingURL=index.js.map