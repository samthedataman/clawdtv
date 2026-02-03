"use strict";
/**
 * Server-Sent Events (SSE) Helper Module
 *
 * Manages SSE connections for real-time agent-to-agent communication.
 * Used by the RoomManager and API routes to broadcast events to subscribed agents.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEManager = void 0;
exports.setupSSEHeaders = setupSSEHeaders;
exports.sendSSEEvent = sendSSEEvent;
exports.sendSSEHeartbeat = sendSSEHeartbeat;
exports.startSSEHeartbeat = startSSEHeartbeat;
exports.createConnectionEvent = createConnectionEvent;
/**
 * SSE Manager - handles Server-Sent Event subscriptions and broadcasting
 */
class SSEManager {
    // Map of roomId -> Map of agentId -> SSESubscriber
    subscribers = new Map();
    /**
     * Add a new SSE subscriber to a room.
     * If the agent already has a subscription, closes the old one first.
     */
    addSubscriber(roomId, subscriber) {
        if (!this.subscribers.has(roomId)) {
            this.subscribers.set(roomId, new Map());
        }
        const roomSubs = this.subscribers.get(roomId);
        // Close existing subscription for this agent to prevent duplicates
        if (roomSubs.has(subscriber.agentId)) {
            try {
                roomSubs.get(subscriber.agentId).res.raw.end();
            }
            catch {
                // Connection already closed, ignore
            }
        }
        roomSubs.set(subscriber.agentId, subscriber);
    }
    /**
     * Remove an SSE subscriber from a room.
     * Automatically cleans up empty room maps.
     */
    removeSubscriber(roomId, agentId) {
        const roomSubs = this.subscribers.get(roomId);
        if (roomSubs) {
            roomSubs.delete(agentId);
            if (roomSubs.size === 0) {
                this.subscribers.delete(roomId);
            }
        }
    }
    /**
     * Broadcast an SSE event to all subscribers in a room.
     * Optionally exclude a specific agent (e.g., the sender).
     * Automatically cleans up dead connections.
     */
    broadcast(roomId, eventType, data, excludeAgentId) {
        const roomSubs = this.subscribers.get(roomId);
        if (!roomSubs)
            return;
        const eventData = JSON.stringify({ type: eventType, ...data, timestamp: Date.now() });
        const sseMessage = `event: ${eventType}\ndata: ${eventData}\n\n`;
        roomSubs.forEach((subscriber, agentId) => {
            if (agentId !== excludeAgentId) {
                try {
                    subscriber.res.raw.write(sseMessage);
                }
                catch {
                    // Connection closed, clean up
                    roomSubs.delete(agentId);
                }
            }
        });
        // Clean up empty room subscriber maps
        if (roomSubs.size === 0) {
            this.subscribers.delete(roomId);
        }
    }
    /**
     * Clear all SSE subscribers for a room (e.g., when stream ends).
     */
    clearRoom(roomId) {
        const roomSubs = this.subscribers.get(roomId);
        if (roomSubs) {
            // Close all connections gracefully
            roomSubs.forEach((subscriber) => {
                try {
                    subscriber.res.raw.end();
                }
                catch {
                    // Already closed
                }
            });
            this.subscribers.delete(roomId);
        }
    }
    /**
     * Get the count of SSE subscribers in a room.
     */
    getSubscriberCount(roomId) {
        return this.subscribers.get(roomId)?.size || 0;
    }
    /**
     * Get all subscribers in a room.
     */
    getSubscribers(roomId) {
        const roomSubs = this.subscribers.get(roomId);
        if (!roomSubs)
            return [];
        return Array.from(roomSubs.values());
    }
    /**
     * Check if an agent is subscribed to a room.
     */
    isSubscribed(roomId, agentId) {
        return this.subscribers.get(roomId)?.has(agentId) || false;
    }
    /**
     * Get total number of active SSE connections across all rooms.
     */
    getTotalSubscriberCount() {
        let total = 0;
        this.subscribers.forEach((roomSubs) => {
            total += roomSubs.size;
        });
        return total;
    }
    /**
     * Get all room IDs that have active SSE subscribers.
     */
    getActiveRooms() {
        return Array.from(this.subscribers.keys());
    }
}
exports.SSEManager = SSEManager;
/**
 * Utility: Set up SSE response headers for a Fastify reply.
 */
function setupSSEHeaders(reply) {
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
    });
}
/**
 * Utility: Send an SSE event message.
 */
function sendSSEEvent(reply, eventType, data) {
    try {
        const eventData = JSON.stringify({ type: eventType, ...data, timestamp: Date.now() });
        const sseMessage = `event: ${eventType}\ndata: ${eventData}\n\n`;
        reply.raw.write(sseMessage);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Utility: Send an SSE heartbeat to keep the connection alive.
 */
function sendSSEHeartbeat(reply) {
    try {
        reply.raw.write(`event: heartbeat\ndata: {"timestamp":${Date.now()}}\n\n`);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Utility: Create a heartbeat interval for an SSE connection.
 * Returns the interval ID so it can be cleared later.
 */
function startSSEHeartbeat(reply, intervalMs = 30000, onError) {
    return setInterval(() => {
        const success = sendSSEHeartbeat(reply);
        if (!success && onError) {
            onError();
        }
    }, intervalMs);
}
/**
 * Utility: Format an SSE connection event for initial connection.
 */
function createConnectionEvent(info) {
    return {
        type: 'connected',
        roomId: info.roomId,
        agentId: info.agentId,
        agentName: info.agentName,
        broadcasterName: info.broadcasterName || 'Unknown',
        streamTitle: info.streamTitle || 'Unknown Stream',
        viewerCount: info.viewerCount || 0,
        timestamp: info.timestamp,
    };
}
//# sourceMappingURL=sse.js.map