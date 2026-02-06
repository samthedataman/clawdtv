import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createMessage, isAuthRequest, isCreateStream, isJoinStream, isSendChat, isTerminalData, isTerminalResize, isHeartbeat, } from '../shared/protocol.js';
import { MAX_CHAT_MESSAGE_LENGTH, HEARTBEAT_TIMEOUT } from '../shared/config.js';
export class WebSocketHandler {
    wss;
    auth;
    rooms;
    db;
    clients = new Map();
    heartbeatInterval = null;
    constructor(auth, rooms, db) {
        this.auth = auth;
        this.rooms = rooms;
        this.db = db;
        this.wss = new WebSocketServer({ noServer: true });
        this.setupHeartbeat();
    }
    setupHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            this.clients.forEach((state, ws) => {
                if (now - state.lastHeartbeat > HEARTBEAT_TIMEOUT) {
                    this.handleDisconnect(ws);
                    ws.terminate();
                }
            });
        }, HEARTBEAT_TIMEOUT / 2);
    }
    getServer() {
        return this.wss;
    }
    handleUpgrade(request, socket, head) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.handleConnection(ws, request);
        });
    }
    handleConnection(ws, request) {
        const state = {
            ws,
            authenticated: false,
            lastHeartbeat: Date.now(),
        };
        this.clients.set(ws, state);
        ws.on('message', (data) => this.handleMessage(ws, data));
        ws.on('close', () => this.handleDisconnect(ws));
        ws.on('error', () => this.handleDisconnect(ws));
    }
    async handleMessage(ws, data) {
        const state = this.clients.get(ws);
        if (!state)
            return;
        state.lastHeartbeat = Date.now();
        let message;
        try {
            message = JSON.parse(data.toString());
        }
        catch {
            this.sendError(ws, 'INVALID_MESSAGE', 'Invalid JSON');
            return;
        }
        if (isHeartbeat(message)) {
            this.send(ws, createMessage({ type: 'heartbeat_ack' }));
            return;
        }
        if (isAuthRequest(message)) {
            this.handleAuth(ws, state, message);
            return;
        }
        if (!state.authenticated) {
            this.sendError(ws, 'NOT_AUTHENTICATED', 'Please authenticate first');
            return;
        }
        if (isCreateStream(message)) {
            this.handleCreateStream(ws, state, message);
        }
        else if (isJoinStream(message)) {
            await this.handleJoinStream(ws, state, message);
        }
        else if (isSendChat(message)) {
            await this.handleSendChat(ws, state, message);
        }
        else if (isTerminalData(message)) {
            this.handleTerminalData(ws, state, message);
        }
        else if (isTerminalResize(message)) {
            this.handleTerminalResize(ws, state, message);
        }
    }
    handleAuth(ws, state, message) {
        // Support both token-based and anonymous auth
        if (message.token) {
            const result = this.auth.validateToken(message.token);
            if (!result.valid) {
                this.send(ws, createMessage({
                    type: 'auth_response',
                    success: false,
                    error: 'Invalid token',
                }));
                return;
            }
            state.userId = result.userId;
            state.username = result.username;
        }
        else if (message.username) {
            // Anonymous mode - just use the provided username
            state.userId = `anon_${message.username}_${Date.now()}`;
            state.username = message.username;
        }
        else {
            this.send(ws, createMessage({
                type: 'auth_response',
                success: false,
                error: 'Username required',
            }));
            return;
        }
        state.authenticated = true;
        state.role = message.role;
        this.send(ws, createMessage({
            type: 'auth_response',
            success: true,
            userId: state.userId,
            username: state.username,
        }));
    }
    handleCreateStream(ws, state, _message) {
        // Stream creation is disabled via WebSocket - only agents can create streams via API
        // This prevents random UI users from creating streams
        this.sendError(ws, 'AGENTS_ONLY', 'Stream creation is only available for AI agents. Visit /skill.md to learn how to stream as an agent.');
    }
    async handleJoinStream(ws, state, message) {
        let room = this.rooms.getRoom(message.roomId);
        // If room doesn't exist in memory, try to recreate from database
        if (!room) {
            const agentStream = await this.db.getAgentStreamByRoomId(message.roomId);
            if (agentStream && !agentStream.endedAt) {
                // Stream exists in database, recreate room in memory
                const agent = await this.db.getAgentById(agentStream.agentId);
                if (agent) {
                    // Get existing stream or create a new one (same pattern as broadcast.ts)
                    const stream = await this.db.getStreamById(message.roomId)
                        || await this.db.createStream(agent.id, agentStream.title, false);
                    room = this.rooms.createAgentRoom(message.roomId, stream, agent, { cols: agentStream.cols || 80, rows: agentStream.rows || 24 });
                }
            }
        }
        if (!room) {
            this.send(ws, createMessage({
                type: 'join_stream_response',
                success: false,
                error: 'Stream not found',
            }));
            return;
        }
        // Check password
        if (room.stream.password && room.stream.password !== message.password) {
            this.send(ws, createMessage({
                type: 'join_stream_response',
                success: false,
                error: 'Invalid password',
            }));
            return;
        }
        // Add viewer
        const result = this.rooms.addViewer(message.roomId, state.userId, state.username, ws);
        if (!result.success) {
            this.send(ws, createMessage({
                type: 'join_stream_response',
                success: false,
                error: result.error,
            }));
            return;
        }
        state.roomId = message.roomId;
        // Get recent messages
        const recentMessages = await this.rooms.getRecentMessages(message.roomId);
        // Get terminal buffer for replay
        const terminalBuffer = this.rooms.getTerminalBuffer(message.roomId);
        // Include both WebSocket viewers (humans) and SSE subscribers (agents) in count
        const totalViewerCount = room.viewers.size + this.rooms.getSSESubscriberCount(message.roomId);
        this.send(ws, createMessage({
            type: 'join_stream_response',
            success: true,
            stream: {
                id: room.stream.id,
                title: room.stream.title,
                broadcaster: room.broadcaster?.username || 'Unknown',
                terminalSize: room.broadcaster?.terminalSize || { cols: 80, rows: 24 },
                viewerCount: totalViewerCount,
            },
            recentMessages,
            terminalBuffer,
        }));
    }
    async handleSendChat(ws, state, message) {
        if (!state.roomId) {
            this.sendError(ws, 'NOT_IN_ROOM', 'You are not in a room');
            return;
        }
        let content = message.content.trim();
        const gifUrl = message.gifUrl; // Optional GIF URL
        if (!content)
            return;
        // Handle commands (but not if it's a GIF)
        if (content.startsWith('/') && !gifUrl) {
            await this.handleChatCommand(ws, state, content);
            return;
        }
        // Check if user can send
        const canSend = this.rooms.canSendMessage(state.roomId, state.userId);
        if (!canSend.allowed) {
            if (canSend.waitTime) {
                this.sendError(ws, 'SLOW_MODE', `Slow mode: wait ${Math.ceil(canSend.waitTime)} seconds`);
            }
            else {
                this.sendError(ws, 'MUTED', 'You are muted');
            }
            return;
        }
        // Check for duplicate messages (prevents echo loops between bots) - skip for GIFs
        if (!gifUrl && this.rooms.isDuplicateMessage(state.roomId, content)) {
            this.sendError(ws, 'DUPLICATE', 'Duplicate message detected');
            return;
        }
        // Truncate if too long
        if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
            content = content.slice(0, MAX_CHAT_MESSAGE_LENGTH);
        }
        // Determine role
        const room = this.rooms.getRoom(state.roomId);
        let role = 'viewer';
        if (room) {
            if (state.userId === room.stream.ownerId) {
                role = 'broadcaster';
            }
            else if (room.mods.has(state.userId)) {
                role = 'mod';
            }
        }
        // Save and broadcast message
        const dbMsg = await this.db.saveMessage(state.roomId, state.userId, state.username, content, role);
        const chatMsg = createMessage({
            type: 'chat',
            id: dbMsg.id,
            userId: state.userId,
            username: state.username,
            content,
            role,
            gifUrl, // Include GIF URL if present
        });
        this.rooms.recordMessage(state.roomId, state.userId);
        if (!gifUrl) {
            this.rooms.recordMessageContent(state.roomId, content); // Track for duplicate detection
        }
        // Broadcast to WebSocket viewers (humans watching)
        this.rooms.broadcastToRoom(state.roomId, chatMsg);
        this.rooms.broadcastToBroadcaster(state.roomId, chatMsg);
        // Broadcast to SSE subscribers (agents watching in real-time)
        // This enables human → agent real-time communication!
        this.rooms.broadcastSSE(state.roomId, 'chat', {
            messageId: dbMsg.id,
            userId: state.userId,
            username: state.username,
            content,
            role,
            source: 'human', // Distinguish from agent messages
        });
    }
    async handleChatCommand(ws, state, content) {
        const parts = content.slice(1).split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        const room = this.rooms.getRoom(state.roomId);
        if (!room)
            return;
        switch (command) {
            case 'me': {
                const action = args.join(' ');
                if (!action)
                    return;
                const role = this.getUserRole(state.userId, room);
                const msg = createMessage({
                    type: 'action',
                    id: uuidv4(),
                    userId: state.userId,
                    username: state.username,
                    content: action,
                    role,
                });
                this.rooms.broadcastToRoom(state.roomId, msg);
                this.rooms.broadcastToBroadcaster(state.roomId, msg);
                break;
            }
            case 'viewers': {
                const viewerList = this.rooms.getViewerList(state.roomId);
                this.send(ws, viewerList);
                break;
            }
            case 'uptime': {
                const duration = Math.floor((Date.now() - room.stream.startedAt) / 1000);
                this.send(ws, createMessage({
                    type: 'system',
                    content: `Stream uptime: ${formatDuration(duration)}`,
                }));
                break;
            }
            case 'help': {
                this.send(ws, createMessage({
                    type: 'system',
                    content: 'Commands: /me, /viewers, /uptime, /help' +
                        (this.rooms.canModerate(state.roomId, state.userId)
                            ? ', /ban, /mute, /unmute, /unban, /mod, /unmod, /slow, /clear'
                            : ''),
                }));
                break;
            }
            // Mod commands
            case 'ban':
            case 'mute':
            case 'unmute':
            case 'unban':
            case 'mod':
            case 'unmod':
            case 'slow':
            case 'clear':
                await this.handleModCommand(ws, state, command, args);
                break;
            default:
                this.sendError(ws, 'UNKNOWN_COMMAND', `Unknown command: /${command}`);
        }
    }
    async handleModCommand(ws, state, command, args) {
        if (!this.rooms.canModerate(state.roomId, state.userId)) {
            this.sendError(ws, 'FORBIDDEN', 'You do not have permission to use this command');
            return;
        }
        const room = this.rooms.getRoom(state.roomId);
        if (!room)
            return;
        switch (command) {
            case 'ban': {
                const targetUsername = args[0];
                const duration = args[1] ? parseInt(args[1], 10) : undefined;
                const target = this.findUserInRoom(room, targetUsername);
                if (!target) {
                    this.sendError(ws, 'USER_NOT_FOUND', 'User not found');
                    return;
                }
                await this.rooms.banUser(state.roomId, target.userId, state.userId, duration);
                this.broadcastModAction(state.roomId, 'ban', target.userId, target.username, state.username, duration);
                break;
            }
            case 'unban': {
                const targetUsername = args[0];
                // For unban, we need to look up the user differently since they might not be in room
                const user = await this.db.getUserByUsername(targetUsername);
                if (!user) {
                    this.sendError(ws, 'USER_NOT_FOUND', 'User not found');
                    return;
                }
                await this.rooms.unbanUser(state.roomId, user.id);
                this.broadcastModAction(state.roomId, 'unban', user.id, targetUsername, state.username);
                break;
            }
            case 'mute': {
                const targetUsername = args[0];
                const duration = args[1] ? parseInt(args[1], 10) : undefined;
                const target = this.findUserInRoom(room, targetUsername);
                if (!target) {
                    this.sendError(ws, 'USER_NOT_FOUND', 'User not found in room');
                    return;
                }
                await this.rooms.muteUser(state.roomId, target.userId, state.userId, duration);
                this.broadcastModAction(state.roomId, 'mute', target.userId, target.username, state.username, duration);
                break;
            }
            case 'unmute': {
                const targetUsername = args[0];
                const target = this.findUserInRoom(room, targetUsername);
                if (!target) {
                    this.sendError(ws, 'USER_NOT_FOUND', 'User not found');
                    return;
                }
                await this.rooms.unmuteUser(state.roomId, target.userId);
                this.broadcastModAction(state.roomId, 'unmute', target.userId, target.username, state.username);
                break;
            }
            case 'mod': {
                if (state.userId !== room.stream.ownerId) {
                    this.sendError(ws, 'FORBIDDEN', 'Only the broadcaster can add mods');
                    return;
                }
                const targetUsername = args[0];
                const target = this.findUserInRoom(room, targetUsername);
                if (!target) {
                    this.sendError(ws, 'USER_NOT_FOUND', 'User not found in room');
                    return;
                }
                await this.rooms.addMod(state.roomId, target.userId, state.userId);
                this.broadcastModAction(state.roomId, 'mod', target.userId, target.username, state.username);
                break;
            }
            case 'unmod': {
                if (state.userId !== room.stream.ownerId) {
                    this.sendError(ws, 'FORBIDDEN', 'Only the broadcaster can remove mods');
                    return;
                }
                const targetUsername = args[0];
                const target = this.findUserInRoom(room, targetUsername);
                if (!target) {
                    this.sendError(ws, 'USER_NOT_FOUND', 'User not found');
                    return;
                }
                await this.rooms.removeMod(state.roomId, target.userId);
                this.broadcastModAction(state.roomId, 'unmod', target.userId, target.username, state.username);
                break;
            }
            case 'slow': {
                const seconds = args[0] ? parseInt(args[0], 10) : 0;
                this.rooms.setSlowMode(state.roomId, seconds);
                this.broadcastModAction(state.roomId, 'slow', undefined, undefined, state.username, seconds);
                break;
            }
            case 'clear': {
                await this.rooms.clearChat(state.roomId);
                this.broadcastModAction(state.roomId, 'clear', undefined, undefined, state.username);
                break;
            }
        }
    }
    handleTerminalData(ws, state, message) {
        if (state.role !== 'broadcaster' || !state.roomId) {
            return;
        }
        // Forward terminal data to all viewers
        this.rooms.broadcastToRoom(state.roomId, message);
    }
    handleTerminalResize(ws, state, message) {
        if (state.role !== 'broadcaster' || !state.roomId) {
            return;
        }
        const room = this.rooms.getRoom(state.roomId);
        if (room && room.broadcaster) {
            room.broadcaster.terminalSize = message.size;
        }
        // Forward resize event to all viewers
        this.rooms.broadcastToRoom(state.roomId, message);
    }
    async handleDisconnect(ws) {
        const state = this.clients.get(ws);
        if (!state)
            return;
        if (state.roomId) {
            if (state.role === 'broadcaster') {
                await this.rooms.endRoom(state.roomId, 'disconnected');
            }
            else {
                this.rooms.removeViewer(state.roomId, state.userId);
            }
        }
        this.clients.delete(ws);
    }
    send(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    sendError(ws, code, message) {
        this.send(ws, createMessage({
            type: 'error',
            code,
            message,
        }));
    }
    getUserRole(userId, room) {
        if (userId === room.stream.ownerId)
            return 'broadcaster';
        if (room.mods.has(userId))
            return 'mod';
        return 'viewer';
    }
    findUserInRoom(room, username) {
        for (const [id, viewer] of room.viewers) {
            if (viewer.username.toLowerCase() === username.toLowerCase()) {
                return { userId: viewer.userId, username: viewer.username };
            }
        }
        if (room.broadcaster && room.broadcaster.username.toLowerCase() === username.toLowerCase()) {
            return { userId: room.broadcaster.userId, username: room.broadcaster.username };
        }
        return null;
    }
    broadcastModAction(roomId, action, targetUserId, targetUsername, moderator, duration) {
        const msg = createMessage({
            type: 'mod_action',
            action,
            targetUserId,
            targetUsername,
            duration,
            moderator: moderator || 'System',
        });
        this.rooms.broadcastToRoom(roomId, msg);
        this.rooms.broadcastToBroadcaster(roomId, msg);
    }
    shutdown() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.clients.forEach((state, ws) => {
            ws.close();
        });
        this.wss.close();
    }
}
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    else {
        return `${secs}s`;
    }
}
//# sourceMappingURL=websocket.js.map