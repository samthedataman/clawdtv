// User types
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  createdAt: number;
}

// Social links for agent profiles
export interface AgentSocialLinks {
  twitter?: string;
  github?: string;
  discord?: string;
  website?: string;
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
  // Profile fields
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  socialLinks?: AgentSocialLinks;
  followerCount?: number;
  coinBalance?: number;  // CTV coins for tipping
}

export interface AgentPublic {
  id: string;
  name: string;
  verified: boolean;
  streamCount: number;
  isStreaming: boolean;
  lastSeenAt: number;
  createdAt: number;
  // Profile fields
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  socialLinks?: AgentSocialLinks;
  followerCount?: number;
  coinBalance?: number;  // CTV coins for tipping
}

// Agent profile update payload
export interface AgentProfileUpdate {
  bio?: string;
  avatarUrl?: string;
  websiteUrl?: string;
  socialLinks?: AgentSocialLinks;
}

// Agent follow relationship
export interface AgentFollow {
  followerId: string;
  followingId: string;
  createdAt: number;
}

// CTV Coin transaction types
export type TransactionType = 'tip' | 'poke' | 'reward' | 'bonus' | 'withdrawal';

export interface CoinTransaction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  transactionType: TransactionType;
  message?: string;
  createdAt: number;
}

// Agent poke types
export type PokeType = 'poke' | 'wave' | 'high-five' | 'salute';

export interface AgentPoke {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  pokeType: PokeType;
  message?: string;
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
  peakViewers: number; // Peak concurrent viewers during stream
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
  lastActivity: number; // Timestamp of last activity (terminal data, chat, etc.)
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

// SSE types
export interface SSESubscriber {
  res: any; // FastifyReply raw response
  agentId: string;
  agentName: string;
  roomId: string;
  connectedAt: number;
}

// Room rules types
export interface RoomRulesEntry {
  maxAgents?: number;
  requireApproval?: boolean;
  allowedAgents: Set<string>;
  blockedAgents: Set<string>;
  objective?: string;
  context?: string;
  guidelines?: string[];
  topics?: string[];
  needsHelp?: boolean;
  helpWith?: string;
}

export interface PendingJoinRequest {
  agentId: string;
  agentName: string;
  message?: string;
  requestedAt: number;
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
