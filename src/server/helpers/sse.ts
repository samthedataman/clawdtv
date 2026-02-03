/**
 * Server-Sent Events (SSE) Helper Module
 *
 * Manages SSE connections for real-time agent-to-agent communication.
 * Used by the RoomManager and API routes to broadcast events to subscribed agents.
 */

export interface SSESubscriber {
  res: any; // FastifyReply raw response
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
export class SSEManager {
  // Map of roomId -> Map of agentId -> SSESubscriber
  private subscribers: Map<string, Map<string, SSESubscriber>> = new Map();

  /**
   * Add a new SSE subscriber to a room.
   * If the agent already has a subscription, closes the old one first.
   */
  addSubscriber(roomId: string, subscriber: SSESubscriber): void {
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, new Map());
    }
    const roomSubs = this.subscribers.get(roomId)!;

    // Close existing subscription for this agent to prevent duplicates
    if (roomSubs.has(subscriber.agentId)) {
      try {
        roomSubs.get(subscriber.agentId)!.res.raw.end();
      } catch {
        // Connection already closed, ignore
      }
    }

    roomSubs.set(subscriber.agentId, subscriber);
  }

  /**
   * Remove an SSE subscriber from a room.
   * Automatically cleans up empty room maps.
   */
  removeSubscriber(roomId: string, agentId: string): void {
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
  broadcast(roomId: string, eventType: string, data: any, excludeAgentId?: string): void {
    const roomSubs = this.subscribers.get(roomId);
    if (!roomSubs) return;

    const eventData = JSON.stringify({ type: eventType, ...data, timestamp: Date.now() });
    const sseMessage = `event: ${eventType}\ndata: ${eventData}\n\n`;

    roomSubs.forEach((subscriber, agentId) => {
      if (agentId !== excludeAgentId) {
        try {
          subscriber.res.raw.write(sseMessage);
        } catch {
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
  clearRoom(roomId: string): void {
    const roomSubs = this.subscribers.get(roomId);
    if (roomSubs) {
      // Close all connections gracefully
      roomSubs.forEach((subscriber) => {
        try {
          subscriber.res.raw.end();
        } catch {
          // Already closed
        }
      });
      this.subscribers.delete(roomId);
    }
  }

  /**
   * Get the count of SSE subscribers in a room.
   */
  getSubscriberCount(roomId: string): number {
    return this.subscribers.get(roomId)?.size || 0;
  }

  /**
   * Get all subscribers in a room.
   */
  getSubscribers(roomId: string): SSESubscriber[] {
    const roomSubs = this.subscribers.get(roomId);
    if (!roomSubs) return [];
    return Array.from(roomSubs.values());
  }

  /**
   * Check if an agent is subscribed to a room.
   */
  isSubscribed(roomId: string, agentId: string): boolean {
    return this.subscribers.get(roomId)?.has(agentId) || false;
  }

  /**
   * Get total number of active SSE connections across all rooms.
   */
  getTotalSubscriberCount(): number {
    let total = 0;
    this.subscribers.forEach((roomSubs) => {
      total += roomSubs.size;
    });
    return total;
  }

  /**
   * Get all room IDs that have active SSE subscribers.
   */
  getActiveRooms(): string[] {
    return Array.from(this.subscribers.keys());
  }
}

/**
 * Utility: Set up SSE response headers for a Fastify reply.
 */
export function setupSSEHeaders(reply: any): void {
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
export function sendSSEEvent(reply: any, eventType: string, data: any): boolean {
  try {
    const eventData = JSON.stringify({ type: eventType, ...data, timestamp: Date.now() });
    const sseMessage = `event: ${eventType}\ndata: ${eventData}\n\n`;
    reply.raw.write(sseMessage);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility: Send an SSE heartbeat to keep the connection alive.
 */
export function sendSSEHeartbeat(reply: any): boolean {
  try {
    reply.raw.write(`event: heartbeat\ndata: {"timestamp":${Date.now()}}\n\n`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility: Create a heartbeat interval for an SSE connection.
 * Returns the interval ID so it can be cleared later.
 */
export function startSSEHeartbeat(
  reply: any,
  intervalMs: number = 30000,
  onError?: () => void
): NodeJS.Timeout {
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
export function createConnectionEvent(info: SSEConnectionInfo): any {
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
