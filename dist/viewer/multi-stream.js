import WebSocket from 'ws';
import { createMessage, } from '../shared/protocol.js';
import { parseServerUrl, HEARTBEAT_INTERVAL } from '../shared/config.js';
export class MultiStreamClient {
    connections = [];
    options;
    heartbeatIntervals = new Map();
    constructor(options) {
        this.options = options;
        // Initialize connections for each room
        for (const roomId of options.roomIds) {
            this.connections.push({
                roomId,
                ws: null,
                connected: false,
                terminalBuffer: '',
                chatMessages: [],
            });
        }
    }
    connect() {
        const { ws: wsUrl } = parseServerUrl(this.options.serverUrl);
        this.connections.forEach((conn, index) => {
            this.connectStream(index, wsUrl);
        });
    }
    connectStream(index, wsUrl) {
        const conn = this.connections[index];
        conn.ws = new WebSocket(`${wsUrl}/ws`);
        conn.ws.on('open', () => {
            this.authenticate(index);
            this.startHeartbeat(index);
        });
        conn.ws.on('message', (data) => {
            this.handleMessage(index, data.toString());
        });
        conn.ws.on('close', () => {
            this.stopHeartbeat(index);
            conn.connected = false;
            this.options.onDisconnect(index);
        });
        conn.ws.on('error', (error) => {
            conn.error = error.message;
            this.options.onError(index, error.message);
        });
    }
    authenticate(index) {
        const conn = this.connections[index];
        this.send(index, createMessage({
            type: 'auth',
            token: this.options.token,
            username: this.options.username,
            role: 'viewer',
            roomId: conn.roomId,
        }));
    }
    handleMessage(index, data) {
        const conn = this.connections[index];
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
                    this.joinStream(index);
                }
                else {
                    conn.error = message.error || 'Authentication failed';
                    this.options.onError(index, conn.error);
                }
                break;
            case 'join_stream_response':
                if (message.success && message.stream) {
                    conn.connected = true;
                    conn.streamInfo = {
                        title: message.stream.title,
                        broadcaster: message.stream.broadcaster,
                        viewerCount: message.stream.viewerCount,
                        terminalSize: message.stream.terminalSize,
                    };
                    this.options.onConnect(index);
                    this.options.onStreamInfo(index, conn.streamInfo);
                    // Load recent messages
                    if (message.recentMessages) {
                        conn.chatMessages = message.recentMessages;
                        for (const msg of conn.chatMessages) {
                            this.options.onChatMessage(index, msg);
                        }
                    }
                }
                else {
                    conn.error = message.error || 'Failed to join stream';
                    this.options.onError(index, conn.error);
                }
                break;
            case 'terminal':
                conn.terminalBuffer += message.data;
                // Keep buffer reasonable size
                if (conn.terminalBuffer.length > 500000) {
                    conn.terminalBuffer = conn.terminalBuffer.slice(-250000);
                }
                this.options.onTerminalData(index, message.data);
                break;
            case 'terminal_resize':
                if (conn.streamInfo) {
                    conn.streamInfo.terminalSize = message.size;
                }
                break;
            case 'chat':
            case 'action':
                conn.chatMessages.push(message);
                if (conn.chatMessages.length > 200) {
                    conn.chatMessages.shift();
                }
                this.options.onChatMessage(index, message);
                break;
            case 'viewer_join':
            case 'viewer_leave':
                if (conn.streamInfo) {
                    conn.streamInfo.viewerCount = message.viewerCount;
                }
                this.options.onViewerCount(index, message.viewerCount);
                this.options.onChatMessage(index, message);
                break;
            case 'stream_end':
                conn.connected = false;
                this.options.onStreamEnd(index, message.reason);
                break;
            case 'error':
                this.options.onError(index, message.message);
                break;
            case 'system':
            case 'mod_action':
                this.options.onChatMessage(index, message);
                break;
            case 'heartbeat_ack':
                break;
        }
    }
    joinStream(index) {
        const conn = this.connections[index];
        const password = this.options.passwords?.get(conn.roomId);
        this.send(index, createMessage({
            type: 'join_stream',
            roomId: conn.roomId,
            password,
        }));
    }
    sendChat(index, content) {
        const conn = this.connections[index];
        if (conn.ws?.readyState === WebSocket.OPEN) {
            this.send(index, createMessage({
                type: 'send_chat',
                content,
            }));
        }
    }
    send(index, message) {
        const conn = this.connections[index];
        if (conn.ws?.readyState === WebSocket.OPEN) {
            conn.ws.send(JSON.stringify(message));
        }
    }
    startHeartbeat(index) {
        const interval = setInterval(() => {
            this.send(index, createMessage({ type: 'heartbeat' }));
        }, HEARTBEAT_INTERVAL);
        this.heartbeatIntervals.set(index, interval);
    }
    stopHeartbeat(index) {
        const interval = this.heartbeatIntervals.get(index);
        if (interval) {
            clearInterval(interval);
            this.heartbeatIntervals.delete(index);
        }
    }
    getConnection(index) {
        return this.connections[index];
    }
    getConnectionCount() {
        return this.connections.length;
    }
    getTerminalBuffer(index) {
        return this.connections[index]?.terminalBuffer || '';
    }
    close() {
        this.connections.forEach((conn, index) => {
            this.stopHeartbeat(index);
            if (conn.ws) {
                conn.ws.close();
                conn.ws = null;
            }
        });
    }
}
//# sourceMappingURL=multi-stream.js.map