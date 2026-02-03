/**
 * Server-Sent Events (SSE) Helper Module
 *
 * Manages SSE connections for real-time agent-to-agent communication.
 * Used by the RoomManager and API routes to broadcast events to subscribed agents.
 */
export interface SSESubscriber {
    res: any;
    agentId: string;
    agentName: string;
    roomId: string;
    connectedAt: number;
}
export interface SSEConnectionInfo {
    roomId: string;
    agentId: string;
    agentName: string;
    broadcasterName?: string;
    streamTitle?: string;
    viewerCount?: number;
    timestamp: number;
}
/**
 * SSE Manager - handles Server-Sent Event subscriptions and broadcasting
 */
export declare class SSEManager {
    private subscribers;
    /**
     * Add a new SSE subscriber to a room.
     * If the agent already has a subscription, closes the old one first.
     */
    addSubscriber(roomId: string, subscriber: SSESubscriber): void;
    /**
     * Remove an SSE subscriber from a room.
     * Automatically cleans up empty room maps.
     */
    removeSubscriber(roomId: string, agentId: string): void;
    /**
     * Broadcast an SSE event to all subscribers in a room.
     * Optionally exclude a specific agent (e.g., the sender).
     * Automatically cleans up dead connections.
     */
    broadcast(roomId: string, eventType: string, data: any, excludeAgentId?: string): void;
    /**
     * Clear all SSE subscribers for a room (e.g., when stream ends).
     */
    clearRoom(roomId: string): void;
    /**
     * Get the count of SSE subscribers in a room.
     */
    getSubscriberCount(roomId: string): number;
    /**
     * Get all subscribers in a room.
     */
    getSubscribers(roomId: string): SSESubscriber[];
    /**
     * Check if an agent is subscribed to a room.
     */
    isSubscribed(roomId: string, agentId: string): boolean;
    /**
     * Get total number of active SSE connections across all rooms.
     */
    getTotalSubscriberCount(): number;
    /**
     * Get all room IDs that have active SSE subscribers.
     */
    getActiveRooms(): string[];
}
/**
 * Utility: Set up SSE response headers for a Fastify reply.
 */
export declare function setupSSEHeaders(reply: any): void;
/**
 * Utility: Send an SSE event message.
 */
export declare function sendSSEEvent(reply: any, eventType: string, data: any): boolean;
/**
 * Utility: Send an SSE heartbeat to keep the connection alive.
 */
export declare function sendSSEHeartbeat(reply: any): boolean;
/**
 * Utility: Create a heartbeat interval for an SSE connection.
 * Returns the interval ID so it can be cleared later.
 */
export declare function startSSEHeartbeat(reply: any, intervalMs?: number, onError?: () => void): NodeJS.Timeout;
/**
 * Utility: Format an SSE connection event for initial connection.
 */
export declare function createConnectionEvent(info: SSEConnectionInfo): any;
//# sourceMappingURL=sse.d.ts.map