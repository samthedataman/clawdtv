import { UserRole, TerminalSize } from './types.js';

// Base message interface
export interface BaseMessage {
  type: string;
  timestamp: number;
}

// Terminal data from broadcaster
export interface TerminalDataMessage extends BaseMessage {
  type: 'terminal';
  data: string; // Raw terminal output with ANSI codes
}

// Terminal resize event
export interface TerminalResizeMessage extends BaseMessage {
  type: 'terminal_resize';
  size: TerminalSize;
}

// Chat message
export interface ChatMessage extends BaseMessage {
  type: 'chat';
  id: string;
  userId: string;
  username: string;
  content: string;
  role: UserRole;
  gifUrl?: string; // Optional GIF URL
}

// Action message (/me command)
export interface ActionMessage extends BaseMessage {
  type: 'action';
  id: string;
  userId: string;
  username: string;
  content: string;
  role: UserRole;
}

// System message
export interface SystemMessage extends BaseMessage {
  type: 'system';
  content: string;
}

// Room events
export interface ViewerJoinEvent extends BaseMessage {
  type: 'viewer_join';
  userId: string;
  username: string;
  viewerCount: number;
}

export interface ViewerLeaveEvent extends BaseMessage {
  type: 'viewer_leave';
  userId: string;
  username: string;
  viewerCount: number;
}

export interface StreamStartEvent extends BaseMessage {
  type: 'stream_start';
  streamId: string;
  title: string;
  broadcaster: string;
}

export interface StreamEndEvent extends BaseMessage {
  type: 'stream_end';
  streamId: string;
  reason: 'ended' | 'disconnected' | 'timeout';
}

// Moderation actions
export interface ModActionMessage extends BaseMessage {
  type: 'mod_action';
  action: 'ban' | 'mute' | 'unmute' | 'unban' | 'clear' | 'mod' | 'unmod' | 'slow';
  targetUserId?: string;
  targetUsername?: string;
  duration?: number; // seconds
  moderator: string;
}

// Viewer list
export interface ViewerListMessage extends BaseMessage {
  type: 'viewer_list';
  viewers: Array<{
    userId: string;
    username: string;
    role: UserRole;
  }>;
  count: number;
}

// Uptime response
export interface UptimeMessage extends BaseMessage {
  type: 'uptime';
  startedAt: number;
  duration: number; // seconds
}

// Error message
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: string;
  message: string;
}

// Authentication messages
export interface AuthRequestMessage extends BaseMessage {
  type: 'auth';
  token?: string;
  username?: string; // For anonymous mode
  role: 'broadcaster' | 'viewer';
  roomId?: string;
  roomPassword?: string;
}

export interface AuthResponseMessage extends BaseMessage {
  type: 'auth_response';
  success: boolean;
  error?: string;
  roomId?: string;
  userId?: string;
  username?: string;
}

// Stream creation (broadcaster)
export interface CreateStreamMessage extends BaseMessage {
  type: 'create_stream';
  title: string;
  isPrivate: boolean;
  password?: string;
  maxViewers?: number;
  terminalSize: TerminalSize;
}

export interface StreamCreatedMessage extends BaseMessage {
  type: 'stream_created';
  streamId: string;
  roomId: string;
}

// Join stream (viewer)
export interface JoinStreamMessage extends BaseMessage {
  type: 'join_stream';
  roomId: string;
  password?: string;
}

export interface JoinStreamResponseMessage extends BaseMessage {
  type: 'join_stream_response';
  success: boolean;
  error?: string;
  stream?: {
    id: string;
    title: string;
    broadcaster: string;
    terminalSize: TerminalSize;
    viewerCount: number;
  };
  recentMessages?: ChatMessage[];
  terminalBuffer?: string; // Replay buffer for stream history
}

// Chat input from client
export interface SendChatMessage extends BaseMessage {
  type: 'send_chat';
  content: string;
  gifUrl?: string; // Optional GIF URL
}

// Heartbeat
export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
}

export interface HeartbeatAckMessage extends BaseMessage {
  type: 'heartbeat_ack';
}

// Union type for all messages
export type ServerMessage =
  | TerminalDataMessage
  | TerminalResizeMessage
  | ChatMessage
  | ActionMessage
  | SystemMessage
  | ViewerJoinEvent
  | ViewerLeaveEvent
  | StreamStartEvent
  | StreamEndEvent
  | ModActionMessage
  | ViewerListMessage
  | UptimeMessage
  | ErrorMessage
  | AuthResponseMessage
  | StreamCreatedMessage
  | JoinStreamResponseMessage
  | HeartbeatAckMessage;

export type ClientMessage =
  | TerminalDataMessage
  | TerminalResizeMessage
  | SendChatMessage
  | AuthRequestMessage
  | CreateStreamMessage
  | JoinStreamMessage
  | HeartbeatMessage;

// Helper to create messages with timestamp
export function createMessage<T extends BaseMessage>(msg: Omit<T, 'timestamp'>): T {
  return {
    ...msg,
    timestamp: Date.now(),
  } as T;
}

// Message type guards
export function isTerminalData(msg: any): msg is TerminalDataMessage {
  return msg.type === 'terminal';
}

export function isChatMessage(msg: any): msg is ChatMessage {
  return msg.type === 'chat';
}

export function isAuthRequest(msg: any): msg is AuthRequestMessage {
  return msg.type === 'auth';
}

export function isCreateStream(msg: any): msg is CreateStreamMessage {
  return msg.type === 'create_stream';
}

export function isJoinStream(msg: any): msg is JoinStreamMessage {
  return msg.type === 'join_stream';
}

export function isSendChat(msg: any): msg is SendChatMessage {
  return msg.type === 'send_chat';
}

export function isHeartbeat(msg: any): msg is HeartbeatMessage {
  return msg.type === 'heartbeat';
}

export function isTerminalResize(msg: any): msg is TerminalResizeMessage {
  return msg.type === 'terminal_resize';
}
