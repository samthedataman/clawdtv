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

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  createRoom(
    ownerId: string,
    ownerUsername: string,
    title: string,
    isPrivate: boolean,
    password?: string,
    maxViewers?: number,
    terminalSize: TerminalSize = { cols: 80, rows: 24 }
  ): { room: Room; stream: Stream } {
    // Create stream in database
    const stream = this.db.createStream(ownerId, title, isPrivate, password, maxViewers);

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
    };

    this.rooms.set(room.id, room);

    // Load existing mods and bans from DB
    const dbMods = this.db.getRoomMods(room.id);
    dbMods.forEach((modId) => room.mods.add(modId));

    const dbBans = this.db.getActiveBans(room.id);
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

  endRoom(roomId: string, reason: string = 'ended'): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // End stream in database
    this.db.endStream(room.stream.id);

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
    };

    this.rooms.set(roomId, room);
    return room;
  }

  // Broadcast terminal data to all viewers in a room (for agent streams)
  broadcastTerminalData(roomId: string, data: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

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

  // Moderation
  banUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const expiry = duration ? Date.now() + duration * 1000 : Infinity;
    room.bans.set(targetUserId, expiry);
    this.db.addBan(roomId, targetUserId, 'ban', moderatorId, duration);

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

  unbanUser(roomId: string, targetUserId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.bans.delete(targetUserId);
    this.db.removeBan(roomId, targetUserId, 'ban');
    return true;
  }

  muteUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const expiry = duration ? Date.now() + duration * 1000 : Infinity;
    room.mutes.set(targetUserId, expiry);
    this.db.addBan(roomId, targetUserId, 'mute', moderatorId, duration);
    return true;
  }

  unmuteUser(roomId: string, targetUserId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.mutes.delete(targetUserId);
    this.db.removeBan(roomId, targetUserId, 'mute');
    return true;
  }

  addMod(roomId: string, targetUserId: string, grantedBy: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.mods.add(targetUserId);
    this.db.addMod(roomId, targetUserId, grantedBy);

    // Update viewer role if present
    const viewer = room.viewers.get(targetUserId);
    if (viewer) {
      viewer.role = 'mod';
    }

    return true;
  }

  removeMod(roomId: string, targetUserId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.mods.delete(targetUserId);
    this.db.removeMod(roomId, targetUserId);

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

  clearChat(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    this.db.clearRoomMessages(roomId);
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
  getRecentMessages(roomId: string): ChatMessage[] {
    const dbMessages = this.db.getRecentMessages(roomId, MAX_RECENT_MESSAGES);
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
}
