// User types
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  createdAt: number;
}

// Agent types (for AI agents like Claude Code)
export interface Agent {
  id: string;
  name: string;
  apiKey: string;
  humanUsername?: string;  // Optional human who claimed this agent
  verified: boolean;
  streamCount: number;
  totalViewers: number;
  lastSeenAt: number;
  createdAt: number;
}

export interface AgentPublic {
  id: string;
  name: string;
  verified: boolean;
  streamCount: number;
  isStreaming: boolean;
  lastSeenAt: number;
  createdAt: number;
}

export interface AgentStream {
  id: string;
  agentId: string;
  roomId: string;
  title: string;
  cols: number;
  rows: number;
  startedAt: number;
  endedAt?: number;
}

export interface UserPublic {
  id: string;
  username: string;
  displayName?: string;
  createdAt: number;
}

// Stream types
export interface Stream {
  id: string;
  ownerId: string;
  title: string;
  isPrivate: boolean;
  password?: string;
  maxViewers?: number;
  startedAt: number;
  endedAt?: number;
}

export interface StreamPublic {
  id: string;
  ownerId: string;
  ownerUsername: string;
  title: string;
  isPrivate: boolean;
  hasPassword: boolean;
  viewerCount: number;
  startedAt: number;
}

// Room types
export interface Room {
  id: string;
  stream: Stream;
  broadcaster: BroadcasterConnection | null;
  viewers: Map<string, ViewerConnection>;
  mods: Set<string>;
  mutes: Map<string, number>; // userId -> expiry timestamp
  bans: Map<string, number>; // userId -> expiry timestamp
  slowMode: number; // seconds between messages, 0 = off
  lastMessages: Map<string, number>; // userId -> last message timestamp
  terminalBuffer: string; // Buffer of recent terminal output for replay
  recentContentHashes: Map<string, number>; // content hash -> timestamp (for duplicate detection)
}

// Connection types
export interface BroadcasterConnection {
  userId: string;
  username: string;
  ws: any; // WebSocket
  terminalSize: TerminalSize;
}

export interface ViewerConnection {
  userId: string;
  username: string;
  ws: any; // WebSocket
  role: UserRole;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

// Chat types
export type UserRole = 'broadcaster' | 'mod' | 'viewer' | 'agent';

export interface ChatMessageDB {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  role: UserRole;
  timestamp: number;
}

// Moderation types
export interface BanRecord {
  id: string;
  roomId: string;
  userId: string;
  type: 'ban' | 'mute';
  expiresAt?: number;
  createdAt: number;
  createdBy: string;
}

// Auth types
export interface AuthToken {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  password: string;
  displayName?: string;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface StreamListResponse {
  streams: StreamPublic[];
}

// Config types
export interface ServerConfig {
  port: number;
  host: string;
  dbPath: string;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export interface ClientConfig {
  serverUrl: string;
  token?: string;
}
