import { v4 as uuidv4 } from 'uuid';
import {
  Room,
  Stream,
  BroadcasterConnection,
  ViewerConnection,
  TerminalSize,
  UserRole,
  Agent,
} from '../shared/types';
import {
  ChatMessage,
  createMessage,
  ViewerJoinEvent,
  ViewerLeaveEvent,
  StreamEndEvent,
  ModActionMessage,
  SystemMessage,
  ViewerListMessage,
} from '../shared/protocol';
import { DatabaseService } from './database';
import { MAX_RECENT_MESSAGES } from '../shared/config';

// SSE Subscriber for real-time agent events
export interface SSESubscriber {
  res: any; // FastifyReply raw response
  agentId: string;
  agentName: string;
  roomId: string;
  connectedAt: number;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private db: DatabaseService;

  // SSE subscribers for real-time agent communication
  // Map of roomId -> Map of agentId -> SSESubscriber
  private sseSubscribers: Map<string, Map<string, SSESubscriber>> = new Map();

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // ============================================
  // SSE SUBSCRIBER MANAGEMENT
  // ============================================

  addSSESubscriber(roomId: string, subscriber: SSESubscriber): void {
    if (!this.sseSubscribers.has(roomId)) {
      this.sseSubscribers.set(roomId, new Map());
    }
    const roomSubs = this.sseSubscribers.get(roomId)!;

    // Close existing subscription for this agent
    if (roomSubs.has(subscriber.agentId)) {
      try {
        roomSubs.get(subscriber.agentId)!.res.raw.end();
      } catch {}
    }

    roomSubs.set(subscriber.agentId, subscriber);
  }

  removeSSESubscriber(roomId: string, agentId: string): void {
    const roomSubs = this.sseSubscribers.get(roomId);
    if (roomSubs) {
      roomSubs.delete(agentId);
      if (roomSubs.size === 0) {
        this.sseSubscribers.delete(roomId);
      }
    }
  }

  // Broadcast SSE event to all subscribers in a room
  // Used by both human WebSocket chat and agent HTTP chat
  broadcastSSE(roomId: string, eventType: string, data: any, excludeAgentId?: string): void {
    const roomSubs = this.sseSubscribers.get(roomId);
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
      this.sseSubscribers.delete(roomId);
    }
  }

  // Clean up all SSE subscribers for a room (when stream ends)
  clearSSESubscribers(roomId: string): void {
    const roomSubs = this.sseSubscribers.get(roomId);
    if (roomSubs) {
      roomSubs.forEach((subscriber) => {
        try {
          subscriber.res.raw.end();
        } catch {
          // Already closed
        }
      });
      this.sseSubscribers.delete(roomId);
    }
  }

  getSSESubscriberCount(roomId: string): number {
    return this.sseSubscribers.get(roomId)?.size || 0;
  }

  async createRoom(
    ownerId: string,
    ownerUsername: string,
    title: string,
    isPrivate: boolean,
    password?: string,
    maxViewers?: number,
    terminalSize: TerminalSize = { cols: 80, rows: 24 }
  ): Promise<{ room: Room; stream: Stream }> {
    // Create stream in database
    const stream = await this.db.createStream(ownerId, title, isPrivate, password, maxViewers);

    // Create room
    const room: Room = {
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
      recentContentHashes: new Map(),
    };

    this.rooms.set(room.id, room);

    // Load existing mods and bans from DB
    const dbMods = await this.db.getRoomMods(room.id);
    dbMods.forEach((modId) => room.mods.add(modId));

    const dbBans = await this.db.getActiveBans(room.id);
    dbBans.forEach((ban) => {
      if (ban.type === 'ban') {
        room.bans.set(ban.userId, ban.expiresAt || Infinity);
      } else {
        room.mutes.set(ban.userId, ban.expiresAt || Infinity);
      }
    });

    return { room, stream };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByStreamId(streamId: string): Room | undefined {
    return this.rooms.get(streamId);
  }

  setBroadcaster(
    roomId: string,
    userId: string,
    username: string,
    ws: any,
    terminalSize: TerminalSize
  ): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.broadcaster = {
      userId,
      username,
      ws,
      terminalSize,
    };

    return true;
  }

  addViewer(
    roomId: string,
    userId: string,
    username: string,
    ws: any
  ): { success: boolean; error?: string } {
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
    let role: UserRole = 'viewer';
    if (userId === room.stream.ownerId) {
      role = 'broadcaster';
    } else if (room.mods.has(userId)) {
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
    this.broadcastToRoom(roomId, createMessage<ViewerJoinEvent>({
      type: 'viewer_join',
      userId,
      username,
      viewerCount: room.viewers.size,
    }), userId);

    return { success: true };
  }

  removeViewer(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(userId);
    if (!viewer) return;

    room.viewers.delete(userId);

    // Broadcast leave event
    this.broadcastToRoom(roomId, createMessage<ViewerLeaveEvent>({
      type: 'viewer_leave',
      userId,
      username: viewer.username,
      viewerCount: room.viewers.size,
    }));
  }

  removeBroadcaster(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.broadcaster = null;

    // Broadcast stream end
    this.broadcastToRoom(roomId, createMessage<StreamEndEvent>({
      type: 'stream_end',
      streamId: room.stream.id,
      reason: 'disconnected',
    }));
  }

  async endRoom(roomId: string, reason: string = 'ended'): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // End stream in database
    await this.db.endStream(room.stream.id);

    // Map custom reasons to valid protocol reasons
    const protocolReason = (reason === 'ended' || reason === 'disconnected' || reason === 'timeout')
      ? reason
      : 'ended';

    // Broadcast end event
    this.broadcastToRoom(roomId, createMessage<StreamEndEvent>({
      type: 'stream_end',
      streamId: room.stream.id,
      reason: protocolReason,
    }));

    // Close all connections
    room.viewers.forEach((viewer) => {
      try {
        viewer.ws.close();
      } catch {}
    });

    if (room.broadcaster) {
      try {
        room.broadcaster.ws.close();
      } catch {}
    }

    this.clearSSESubscribers(roomId);
    this.rooms.delete(roomId);
  }

  // Create a room for an agent stream (no WebSocket broadcaster required)
  createAgentRoom(
    roomId: string,
    stream: Stream,
    agent: Agent,
    terminalSize: TerminalSize = { cols: 80, rows: 24 }
  ): Room {
    const room: Room = {
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
      recentContentHashes: new Map(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // Broadcast terminal data to all viewers in a room (for agent streams)
  broadcastTerminalData(roomId: string, data: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

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
      } catch {}
    });
  }

  // Get terminal buffer for replay to new viewers
  getTerminalBuffer(roomId: string): string {
    const room = this.rooms.get(roomId);
    return room?.terminalBuffer || '';
  }

  // Moderation
  async banUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const expiry = duration ? Date.now() + duration * 1000 : Infinity;
    room.bans.set(targetUserId, expiry);
    await this.db.addBan(roomId, targetUserId, 'ban', moderatorId, duration);

    // Kick the user if they're viewing
    const viewer = room.viewers.get(targetUserId);
    if (viewer) {
      this.removeViewer(roomId, targetUserId);
      try {
        viewer.ws.close();
      } catch {}
    }

    return true;
  }

  async unbanUser(roomId: string, targetUserId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.bans.delete(targetUserId);
    await this.db.removeBan(roomId, targetUserId, 'ban');
    return true;
  }

  async muteUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const expiry = duration ? Date.now() + duration * 1000 : Infinity;
    room.mutes.set(targetUserId, expiry);
    await this.db.addBan(roomId, targetUserId, 'mute', moderatorId, duration);
    return true;
  }

  async unmuteUser(roomId: string, targetUserId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.mutes.delete(targetUserId);
    await this.db.removeBan(roomId, targetUserId, 'mute');
    return true;
  }

  async addMod(roomId: string, targetUserId: string, grantedBy: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.mods.add(targetUserId);
    await this.db.addMod(roomId, targetUserId, grantedBy);

    // Update viewer role if present
    const viewer = room.viewers.get(targetUserId);
    if (viewer) {
      viewer.role = 'mod';
    }

    return true;
  }

  async removeMod(roomId: string, targetUserId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.mods.delete(targetUserId);
    await this.db.removeMod(roomId, targetUserId);

    // Update viewer role if present
    const viewer = room.viewers.get(targetUserId);
    if (viewer && viewer.role === 'mod') {
      viewer.role = 'viewer';
    }

    return true;
  }

  setSlowMode(roomId: string, seconds: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.slowMode = seconds;
    return true;
  }

  async clearChat(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    await this.db.clearRoomMessages(roomId);
    return true;
  }

  // Check permissions
  canModerate(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    return userId === room.stream.ownerId || room.mods.has(userId);
  }

  isMuted(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const expiry = room.mutes.get(userId);
    if (!expiry) return false;
    if (expiry === Infinity) return true;
    if (expiry > Date.now()) return true;

    // Expired, clean up
    room.mutes.delete(userId);
    return false;
  }

  canSendMessage(roomId: string, userId: string): { allowed: boolean; waitTime?: number } {
    const room = this.rooms.get(roomId);
    if (!room) return { allowed: false };

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

  recordMessage(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastMessages.set(userId, Date.now());
    }
  }

  // Check if a message is a duplicate (same content sent recently)
  // This prevents echo loops between bots
  isDuplicateMessage(roomId: string, content: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const DUPLICATE_WINDOW_MS = 5000; // 5 second window
    const now = Date.now();

    // Clean up old hashes first
    for (const [hash, timestamp] of room.recentContentHashes) {
      if (now - timestamp > DUPLICATE_WINDOW_MS) {
        room.recentContentHashes.delete(hash);
      }
    }

    // Simple hash: lowercase trimmed content
    const hash = content.toLowerCase().trim();

    if (room.recentContentHashes.has(hash)) {
      return true; // Duplicate found
    }

    return false;
  }

  // Record a message content hash
  recordMessageContent(roomId: string, content: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const hash = content.toLowerCase().trim();
    room.recentContentHashes.set(hash, Date.now());
  }

  // Get viewer list
  getViewerList(roomId: string): ViewerListMessage {
    const room = this.rooms.get(roomId);
    if (!room) {
      return createMessage<ViewerListMessage>({
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

    return createMessage<ViewerListMessage>({
      type: 'viewer_list',
      viewers,
      count: viewers.length,
    });
  }

  // Broadcast to room
  broadcastToRoom(roomId: string, message: any, excludeUserId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const data = JSON.stringify(message);

    room.viewers.forEach((viewer) => {
      if (viewer.userId !== excludeUserId) {
        try {
          viewer.ws.send(data);
        } catch {}
      }
    });
  }

  broadcastToBroadcaster(roomId: string, message: any): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.broadcaster) return;

    try {
      room.broadcaster.ws.send(JSON.stringify(message));
    } catch {}
  }

  // Get active rooms for listing
  getActiveRooms(): Array<{
    id: string;
    title: string;
    ownerId: string;
    ownerUsername: string;
    viewerCount: number;
    isPrivate: boolean;
    hasPassword: boolean;
    startedAt: number;
  }> {
    const result: Array<{
      id: string;
      title: string;
      ownerId: string;
      ownerUsername: string;
      viewerCount: number;
      isPrivate: boolean;
      hasPassword: boolean;
      startedAt: number;
    }> = [];

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
  async getRecentMessages(roomId: string): Promise<ChatMessage[]> {
    const dbMessages = await this.db.getRecentMessages(roomId, MAX_RECENT_MESSAGES);
    return dbMessages.map((msg) => ({
      type: 'chat' as const,
      id: msg.id,
      userId: msg.userId,
      username: msg.username,
      content: msg.content,
      role: msg.role,
      timestamp: msg.timestamp,
    }));
  }

  // Add an agent as a viewer (no WebSocket, just tracking)
  addAgentViewer(roomId: string, agentId: string, agentName: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Add agent as a virtual viewer (ws is null for agents using HTTP API)
    room.viewers.set(agentId, {
      userId: agentId,
      username: agentName,
      ws: null as any, // Agent viewers use HTTP API, not WebSocket
      role: 'viewer',
    });

    // Broadcast join event
    this.broadcastToRoom(roomId, createMessage<ViewerJoinEvent>({
      type: 'viewer_join',
      userId: agentId,
      username: agentName,
      viewerCount: room.viewers.size,
    }), agentId);

    return true;
  }

  // Remove an agent viewer
  removeAgentViewer(roomId: string, agentId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const viewer = room.viewers.get(agentId);
    if (!viewer) return;

    room.viewers.delete(agentId);

    // Broadcast leave event
    this.broadcastToRoom(roomId, createMessage<ViewerLeaveEvent>({
      type: 'viewer_leave',
      userId: agentId,
      username: viewer.username,
      viewerCount: room.viewers.size,
    }));
  }
}
