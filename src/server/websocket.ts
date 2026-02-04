import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from './auth.js';
import { RoomManager } from './rooms.js';
import { DatabaseService } from './database.js';
import {
  ClientMessage,
  createMessage,
  isAuthRequest,
  isCreateStream,
  isJoinStream,
  isSendChat,
  isTerminalData,
  isTerminalResize,
  isHeartbeat,
  AuthResponseMessage,
  StreamCreatedMessage,
  JoinStreamResponseMessage,
  ChatMessage,
  ActionMessage,
  SystemMessage,
  ModActionMessage,
  ErrorMessage,
  HeartbeatAckMessage,
  TerminalDataMessage,
  TerminalResizeMessage,
} from '../shared/protocol.js';
import { UserRole } from '../shared/types.js';
import { MAX_CHAT_MESSAGE_LENGTH, HEARTBEAT_TIMEOUT } from '../shared/config.js';

interface ClientState {
  ws: WebSocket;
  userId?: string;
  username?: string;
  role?: 'broadcaster' | 'viewer';
  roomId?: string;
  authenticated: boolean;
  lastHeartbeat: number;
}

export class WebSocketHandler {
  private wss: WebSocketServer;
  private auth: AuthService;
  private rooms: RoomManager;
  private db: DatabaseService;
  private clients: Map<WebSocket, ClientState> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(auth: AuthService, rooms: RoomManager, db: DatabaseService) {
    this.auth = auth;
    this.rooms = rooms;
    this.db = db;
    this.wss = new WebSocketServer({ noServer: true });
    this.setupHeartbeat();
  }

  private setupHeartbeat(): void {
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

  getServer(): WebSocketServer {
    return this.wss;
  }

  handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.handleConnection(ws, request);
    });
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const state: ClientState = {
      ws,
      authenticated: false,
      lastHeartbeat: Date.now(),
    };
    this.clients.set(ws, state);

    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleDisconnect(ws));
    ws.on('error', () => this.handleDisconnect(ws));
  }

  private async handleMessage(ws: WebSocket, data: any): Promise<void> {
    const state = this.clients.get(ws);
    if (!state) return;

    state.lastHeartbeat = Date.now();

    let message: ClientMessage;
    try {
      message = JSON.parse(data.toString());
    } catch {
      this.sendError(ws, 'INVALID_MESSAGE', 'Invalid JSON');
      return;
    }

    if (isHeartbeat(message)) {
      this.send(ws, createMessage<HeartbeatAckMessage>({ type: 'heartbeat_ack' }));
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
    } else if (isJoinStream(message)) {
      await this.handleJoinStream(ws, state, message);
    } else if (isSendChat(message)) {
      await this.handleSendChat(ws, state, message);
    } else if (isTerminalData(message)) {
      this.handleTerminalData(ws, state, message);
    } else if (isTerminalResize(message)) {
      this.handleTerminalResize(ws, state, message);
    }
  }

  private handleAuth(ws: WebSocket, state: ClientState, message: any): void {
    // Support both token-based and anonymous auth
    if (message.token) {
      const result = this.auth.validateToken(message.token);
      if (!result.valid) {
        this.send(ws, createMessage<AuthResponseMessage>({
          type: 'auth_response',
          success: false,
          error: 'Invalid token',
        }));
        return;
      }
      state.userId = result.userId;
      state.username = result.username;
    } else if (message.username) {
      // Anonymous mode - just use the provided username
      state.userId = `anon_${message.username}_${Date.now()}`;
      state.username = message.username;
    } else {
      this.send(ws, createMessage<AuthResponseMessage>({
        type: 'auth_response',
        success: false,
        error: 'Username required',
      }));
      return;
    }

    state.authenticated = true;
    state.role = message.role;

    this.send(ws, createMessage<AuthResponseMessage>({
      type: 'auth_response',
      success: true,
      userId: state.userId,
      username: state.username,
    }));
  }

  private handleCreateStream(ws: WebSocket, state: ClientState, _message: any): void {
    // Stream creation is disabled via WebSocket - only agents can create streams via API
    // This prevents random UI users from creating streams
    this.sendError(
      ws,
      'AGENTS_ONLY',
      'Stream creation is only available for AI agents. Visit /skill.md to learn how to stream as an agent.'
    );
  }

  private async handleJoinStream(ws: WebSocket, state: ClientState, message: any): Promise<void> {
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

          room = this.rooms.createAgentRoom(
            message.roomId,
            stream,
            agent,
            { cols: agentStream.cols || 80, rows: agentStream.rows || 24 }
          );
        }
      }
    }

    if (!room) {
      this.send(ws, createMessage<JoinStreamResponseMessage>({
        type: 'join_stream_response',
        success: false,
        error: 'Stream not found',
      }));
      return;
    }

    // Check password
    if (room.stream.password && room.stream.password !== message.password) {
      this.send(ws, createMessage<JoinStreamResponseMessage>({
        type: 'join_stream_response',
        success: false,
        error: 'Invalid password',
      }));
      return;
    }

    // Add viewer
    const result = this.rooms.addViewer(message.roomId, state.userId!, state.username!, ws);
    if (!result.success) {
      this.send(ws, createMessage<JoinStreamResponseMessage>({
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

    this.send(ws, createMessage<JoinStreamResponseMessage>({
      type: 'join_stream_response',
      success: true,
      stream: {
        id: room.stream.id,
        title: room.stream.title,
        broadcaster: room.broadcaster?.username || 'Unknown',
        terminalSize: room.broadcaster?.terminalSize || { cols: 80, rows: 24 },
        viewerCount: room.viewers.size,
      },
      recentMessages,
      terminalBuffer,
    }));
  }

  private async handleSendChat(ws: WebSocket, state: ClientState, message: any): Promise<void> {
    if (!state.roomId) {
      this.sendError(ws, 'NOT_IN_ROOM', 'You are not in a room');
      return;
    }

    let content = message.content.trim();
    const gifUrl = message.gifUrl; // Optional GIF URL
    if (!content) return;

    // Handle commands (but not if it's a GIF)
    if (content.startsWith('/') && !gifUrl) {
      await this.handleChatCommand(ws, state, content);
      return;
    }

    // Check if user can send
    const canSend = this.rooms.canSendMessage(state.roomId, state.userId!);
    if (!canSend.allowed) {
      if (canSend.waitTime) {
        this.sendError(ws, 'SLOW_MODE', `Slow mode: wait ${Math.ceil(canSend.waitTime)} seconds`);
      } else {
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
    let role: UserRole = 'viewer';
    if (room) {
      if (state.userId === room.stream.ownerId) {
        role = 'broadcaster';
      } else if (room.mods.has(state.userId!)) {
        role = 'mod';
      }
    }

    // Save and broadcast message
    const dbMsg = await this.db.saveMessage(
      state.roomId,
      state.userId!,
      state.username!,
      content,
      role
    );

    const chatMsg = createMessage<ChatMessage>({
      type: 'chat',
      id: dbMsg.id,
      userId: state.userId!,
      username: state.username!,
      content,
      role,
      gifUrl, // Include GIF URL if present
    });

    this.rooms.recordMessage(state.roomId, state.userId!);
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

  private async handleChatCommand(ws: WebSocket, state: ClientState, content: string): Promise<void> {
    const parts = content.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const room = this.rooms.getRoom(state.roomId!);
    if (!room) return;

    switch (command) {
      case 'me': {
        const action = args.join(' ');
        if (!action) return;

        const role = this.getUserRole(state.userId!, room);
        const msg = createMessage<ActionMessage>({
          type: 'action',
          id: uuidv4(),
          userId: state.userId!,
          username: state.username!,
          content: action,
          role,
        });
        this.rooms.broadcastToRoom(state.roomId!, msg);
        this.rooms.broadcastToBroadcaster(state.roomId!, msg);
        break;
      }

      case 'viewers': {
        const viewerList = this.rooms.getViewerList(state.roomId!);
        this.send(ws, viewerList);
        break;
      }

      case 'uptime': {
        const duration = Math.floor((Date.now() - room.stream.startedAt) / 1000);
        this.send(ws, createMessage<SystemMessage>({
          type: 'system',
          content: `Stream uptime: ${formatDuration(duration)}`,
        }));
        break;
      }

      case 'help': {
        this.send(ws, createMessage<SystemMessage>({
          type: 'system',
          content: 'Commands: /me, /viewers, /uptime, /help' +
            (this.rooms.canModerate(state.roomId!, state.userId!)
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

  private async handleModCommand(
    ws: WebSocket,
    state: ClientState,
    command: string,
    args: string[]
  ): Promise<void> {
    if (!this.rooms.canModerate(state.roomId!, state.userId!)) {
      this.sendError(ws, 'FORBIDDEN', 'You do not have permission to use this command');
      return;
    }

    const room = this.rooms.getRoom(state.roomId!);
    if (!room) return;

    switch (command) {
      case 'ban': {
        const targetUsername = args[0];
        const duration = args[1] ? parseInt(args[1], 10) : undefined;
        const target = this.findUserInRoom(room, targetUsername);
        if (!target) {
          this.sendError(ws, 'USER_NOT_FOUND', 'User not found');
          return;
        }
        await this.rooms.banUser(state.roomId!, target.userId, state.userId!, duration);
        this.broadcastModAction(state.roomId!, 'ban', target.userId, target.username, state.username!, duration);
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
        await this.rooms.unbanUser(state.roomId!, user.id);
        this.broadcastModAction(state.roomId!, 'unban', user.id, targetUsername, state.username!);
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
        await this.rooms.muteUser(state.roomId!, target.userId, state.userId!, duration);
        this.broadcastModAction(state.roomId!, 'mute', target.userId, target.username, state.username!, duration);
        break;
      }

      case 'unmute': {
        const targetUsername = args[0];
        const target = this.findUserInRoom(room, targetUsername);
        if (!target) {
          this.sendError(ws, 'USER_NOT_FOUND', 'User not found');
          return;
        }
        await this.rooms.unmuteUser(state.roomId!, target.userId);
        this.broadcastModAction(state.roomId!, 'unmute', target.userId, target.username, state.username!);
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
        await this.rooms.addMod(state.roomId!, target.userId, state.userId!);
        this.broadcastModAction(state.roomId!, 'mod', target.userId, target.username, state.username!);
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
        await this.rooms.removeMod(state.roomId!, target.userId);
        this.broadcastModAction(state.roomId!, 'unmod', target.userId, target.username, state.username!);
        break;
      }

      case 'slow': {
        const seconds = args[0] ? parseInt(args[0], 10) : 0;
        this.rooms.setSlowMode(state.roomId!, seconds);
        this.broadcastModAction(state.roomId!, 'slow', undefined, undefined, state.username!, seconds);
        break;
      }

      case 'clear': {
        await this.rooms.clearChat(state.roomId!);
        this.broadcastModAction(state.roomId!, 'clear', undefined, undefined, state.username!);
        break;
      }
    }
  }

  private handleTerminalData(ws: WebSocket, state: ClientState, message: TerminalDataMessage): void {
    if (state.role !== 'broadcaster' || !state.roomId) {
      return;
    }

    // Forward terminal data to all viewers
    this.rooms.broadcastToRoom(state.roomId, message);
  }

  private handleTerminalResize(ws: WebSocket, state: ClientState, message: TerminalResizeMessage): void {
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

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const state = this.clients.get(ws);
    if (!state) return;

    if (state.roomId) {
      if (state.role === 'broadcaster') {
        await this.rooms.endRoom(state.roomId, 'disconnected');
      } else {
        this.rooms.removeViewer(state.roomId, state.userId!);
      }
    }

    this.clients.delete(ws);
  }

  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, createMessage<ErrorMessage>({
      type: 'error',
      code,
      message,
    }));
  }

  private getUserRole(userId: string, room: any): UserRole {
    if (userId === room.stream.ownerId) return 'broadcaster';
    if (room.mods.has(userId)) return 'mod';
    return 'viewer';
  }

  private findUserInRoom(room: any, username: string): { userId: string; username: string } | null {
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

  private broadcastModAction(
    roomId: string,
    action: ModActionMessage['action'],
    targetUserId?: string,
    targetUsername?: string,
    moderator?: string,
    duration?: number
  ): void {
    const msg = createMessage<ModActionMessage>({
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

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.clients.forEach((state, ws) => {
      ws.close();
    });
    this.wss.close();
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}
