"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const protocol_1 = require("../shared/protocol");
const config_1 = require("../shared/config");
class RoomManager {
    rooms = new Map();
    db;
    constructor(db) {
        this.db = db;
    }
    createRoom(ownerId, ownerUsername, title, isPrivate, password, maxViewers, terminalSize = { cols: 80, rows: 24 }) {
        // Create stream in database
        const stream = this.db.createStream(ownerId, title, isPrivate, password, maxViewers);
        // Create room
        const room = {
            id: stream.id,
            stream,
            broadcaster: null,
            viewers: new Map(),
            mods: new Set(),
            mutes: new Map(),
            bans: new Map(),
            slowMode: 0,
            lastMessages: new Map(),
            terminalBuffer: '',
        };
        this.rooms.set(room.id, room);
        // Load existing mods and bans from DB
        const dbMods = this.db.getRoomMods(room.id);
        dbMods.forEach((modId) => room.mods.add(modId));
        const dbBans = this.db.getActiveBans(room.id);
        dbBans.forEach((ban) => {
            if (ban.type === 'ban') {
                room.bans.set(ban.userId, ban.expiresAt || Infinity);
            }
            else {
                room.mutes.set(ban.userId, ban.expiresAt || Infinity);
            }
        });
        return { room, stream };
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    getRoomByStreamId(streamId) {
        return this.rooms.get(streamId);
    }
    setBroadcaster(roomId, userId, username, ws, terminalSize) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        room.broadcaster = {
            userId,
            username,
            ws,
            terminalSize,
        };
        return true;
    }
    addViewer(roomId, userId, username, ws) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        // Check if banned
        const banExpiry = room.bans.get(userId);
        if (banExpiry && (banExpiry === Infinity || banExpiry > Date.now())) {
            return { success: false, error: 'You are banned from this room' };
        }
        // Check max viewers
        if (room.stream.maxViewers && room.viewers.size >= room.stream.maxViewers) {
            return { success: false, error: 'Room is full' };
        }
        // Determine role
        let role = 'viewer';
        if (userId === room.stream.ownerId) {
            role = 'broadcaster';
        }
        else if (room.mods.has(userId)) {
            role = 'mod';
        }
        // Add viewer
        room.viewers.set(userId, {
            userId,
            username,
            ws,
            role,
        });
        // Broadcast join event
        this.broadcastToRoom(roomId, (0, protocol_1.createMessage)({
            type: 'viewer_join',
            userId,
            username,
            viewerCount: room.viewers.size,
        }), userId);
        return { success: true };
    }
    removeViewer(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const viewer = room.viewers.get(userId);
        if (!viewer)
            return;
        room.viewers.delete(userId);
        // Broadcast leave event
        this.broadcastToRoom(roomId, (0, protocol_1.createMessage)({
            type: 'viewer_leave',
            userId,
            username: viewer.username,
            viewerCount: room.viewers.size,
        }));
    }
    removeBroadcaster(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        room.broadcaster = null;
        // Broadcast stream end
        this.broadcastToRoom(roomId, (0, protocol_1.createMessage)({
            type: 'stream_end',
            streamId: room.stream.id,
            reason: 'disconnected',
        }));
    }
    endRoom(roomId, reason = 'ended') {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        // End stream in database
        this.db.endStream(room.stream.id);
        // Map custom reasons to valid protocol reasons
        const protocolReason = (reason === 'ended' || reason === 'disconnected' || reason === 'timeout')
            ? reason
            : 'ended';
        // Broadcast end event
        this.broadcastToRoom(roomId, (0, protocol_1.createMessage)({
            type: 'stream_end',
            streamId: room.stream.id,
            reason: protocolReason,
        }));
        // Close all connections
        room.viewers.forEach((viewer) => {
            try {
                viewer.ws.close();
            }
            catch { }
        });
        if (room.broadcaster) {
            try {
                room.broadcaster.ws.close();
            }
            catch { }
        }
        this.rooms.delete(roomId);
    }
    // Create a room for an agent stream (no WebSocket broadcaster required)
    createAgentRoom(roomId, stream, agent, terminalSize = { cols: 80, rows: 24 }) {
        const room = {
            id: roomId,
            stream,
            broadcaster: {
                userId: agent.id,
                username: agent.name,
                ws: null, // Agent streams use HTTP API, not persistent WebSocket
                terminalSize,
            },
            viewers: new Map(),
            mods: new Set(),
            mutes: new Map(),
            bans: new Map(),
            slowMode: 0,
            lastMessages: new Map(),
            terminalBuffer: '',
        };
        this.rooms.set(roomId, room);
        return room;
    }
    // Broadcast terminal data to all viewers in a room (for agent streams)
    broadcastTerminalData(roomId, data) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        // Store in buffer for replay (limit to ~100KB)
        const MAX_BUFFER_SIZE = 100000;
        room.terminalBuffer += data;
        if (room.terminalBuffer.length > MAX_BUFFER_SIZE) {
            // Keep the last 80KB to avoid losing context mid-line
            room.terminalBuffer = room.terminalBuffer.slice(-80000);
        }
        const message = JSON.stringify({
            type: 'terminal',
            data,
        });
        room.viewers.forEach((viewer) => {
            try {
                viewer.ws.send(message);
            }
            catch { }
        });
    }
    // Get terminal buffer for replay to new viewers
    getTerminalBuffer(roomId) {
        const room = this.rooms.get(roomId);
        return room?.terminalBuffer || '';
    }
    // Moderation
    banUser(roomId, targetUserId, moderatorId, duration) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        const expiry = duration ? Date.now() + duration * 1000 : Infinity;
        room.bans.set(targetUserId, expiry);
        this.db.addBan(roomId, targetUserId, 'ban', moderatorId, duration);
        // Kick the user if they're viewing
        const viewer = room.viewers.get(targetUserId);
        if (viewer) {
            this.removeViewer(roomId, targetUserId);
            try {
                viewer.ws.close();
            }
            catch { }
        }
        return true;
    }
    unbanUser(roomId, targetUserId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        room.bans.delete(targetUserId);
        this.db.removeBan(roomId, targetUserId, 'ban');
        return true;
    }
    muteUser(roomId, targetUserId, moderatorId, duration) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        const expiry = duration ? Date.now() + duration * 1000 : Infinity;
        room.mutes.set(targetUserId, expiry);
        this.db.addBan(roomId, targetUserId, 'mute', moderatorId, duration);
        return true;
    }
    unmuteUser(roomId, targetUserId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        room.mutes.delete(targetUserId);
        this.db.removeBan(roomId, targetUserId, 'mute');
        return true;
    }
    addMod(roomId, targetUserId, grantedBy) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        room.mods.add(targetUserId);
        this.db.addMod(roomId, targetUserId, grantedBy);
        // Update viewer role if present
        const viewer = room.viewers.get(targetUserId);
        if (viewer) {
            viewer.role = 'mod';
        }
        return true;
    }
    removeMod(roomId, targetUserId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        room.mods.delete(targetUserId);
        this.db.removeMod(roomId, targetUserId);
        // Update viewer role if present
        const viewer = room.viewers.get(targetUserId);
        if (viewer && viewer.role === 'mod') {
            viewer.role = 'viewer';
        }
        return true;
    }
    setSlowMode(roomId, seconds) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        room.slowMode = seconds;
        return true;
    }
    clearChat(roomId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        this.db.clearRoomMessages(roomId);
        return true;
    }
    // Check permissions
    canModerate(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        return userId === room.stream.ownerId || room.mods.has(userId);
    }
    isMuted(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        const expiry = room.mutes.get(userId);
        if (!expiry)
            return false;
        if (expiry === Infinity)
            return true;
        if (expiry > Date.now())
            return true;
        // Expired, clean up
        room.mutes.delete(userId);
        return false;
    }
    canSendMessage(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return { allowed: false };
        // Check mute
        if (this.isMuted(roomId, userId)) {
            return { allowed: false };
        }
        // Check slow mode (mods and broadcaster exempt)
        if (room.slowMode > 0 && !this.canModerate(roomId, userId)) {
            const lastMessage = room.lastMessages.get(userId) || 0;
            const elapsed = (Date.now() - lastMessage) / 1000;
            if (elapsed < room.slowMode) {
                return { allowed: false, waitTime: room.slowMode - elapsed };
            }
        }
        return { allowed: true };
    }
    recordMessage(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.lastMessages.set(userId, Date.now());
        }
    }
    // Get viewer list
    getViewerList(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return (0, protocol_1.createMessage)({
                type: 'viewer_list',
                viewers: [],
                count: 0,
            });
        }
        const viewers = Array.from(room.viewers.values()).map((v) => ({
            userId: v.userId,
            username: v.username,
            role: v.role,
        }));
        return (0, protocol_1.createMessage)({
            type: 'viewer_list',
            viewers,
            count: viewers.length,
        });
    }
    // Broadcast to room
    broadcastToRoom(roomId, message, excludeUserId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const data = JSON.stringify(message);
        room.viewers.forEach((viewer) => {
            if (viewer.userId !== excludeUserId) {
                try {
                    viewer.ws.send(data);
                }
                catch { }
            }
        });
    }
    broadcastToBroadcaster(roomId, message) {
        const room = this.rooms.get(roomId);
        if (!room || !room.broadcaster)
            return;
        try {
            room.broadcaster.ws.send(JSON.stringify(message));
        }
        catch { }
    }
    // Get active rooms for listing
    getActiveRooms() {
        const result = [];
        this.rooms.forEach((room) => {
            if (room.broadcaster) {
                result.push({
                    id: room.id,
                    title: room.stream.title,
                    ownerId: room.stream.ownerId,
                    ownerUsername: room.broadcaster.username,
                    viewerCount: room.viewers.size,
                    isPrivate: room.stream.isPrivate,
                    hasPassword: !!room.stream.password,
                    startedAt: room.stream.startedAt,
                });
            }
        });
        return result;
    }
    // Get recent messages for a room
    getRecentMessages(roomId) {
        const dbMessages = this.db.getRecentMessages(roomId, config_1.MAX_RECENT_MESSAGES);
        return dbMessages.map((msg) => ({
            type: 'chat',
            id: msg.id,
            userId: msg.userId,
            username: msg.username,
            content: msg.content,
            role: msg.role,
            timestamp: msg.timestamp,
        }));
    }
    // Add an agent as a viewer (no WebSocket, just tracking)
    addAgentViewer(roomId, agentId, agentName) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        // Add agent as a virtual viewer (ws is null for agents using HTTP API)
        room.viewers.set(agentId, {
            userId: agentId,
            username: agentName,
            ws: null, // Agent viewers use HTTP API, not WebSocket
            role: 'viewer',
        });
        // Broadcast join event
        this.broadcastToRoom(roomId, (0, protocol_1.createMessage)({
            type: 'viewer_join',
            userId: agentId,
            username: agentName,
            viewerCount: room.viewers.size,
        }), agentId);
        return true;
    }
    // Remove an agent viewer
    removeAgentViewer(roomId, agentId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        const viewer = room.viewers.get(agentId);
        if (!viewer)
            return;
        room.viewers.delete(agentId);
        // Broadcast leave event
        this.broadcastToRoom(roomId, (0, protocol_1.createMessage)({
            type: 'viewer_leave',
            userId: agentId,
            username: viewer.username,
            viewerCount: room.viewers.size,
        }));
    }
}
exports.RoomManager = RoomManager;
//# sourceMappingURL=rooms.js.map