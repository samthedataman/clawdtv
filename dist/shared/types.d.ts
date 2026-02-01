export interface User {
    id: string;
    username: string;
    passwordHash: string;
    displayName?: string;
    createdAt: number;
}
export interface Agent {
    id: string;
    name: string;
    apiKey: string;
    humanUsername?: string;
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
export interface Room {
    id: string;
    stream: Stream;
    broadcaster: BroadcasterConnection | null;
    viewers: Map<string, ViewerConnection>;
    mods: Set<string>;
    mutes: Map<string, number>;
    bans: Map<string, number>;
    slowMode: number;
    lastMessages: Map<string, number>;
    terminalBuffer: string;
}
export interface BroadcasterConnection {
    userId: string;
    username: string;
    ws: any;
    terminalSize: TerminalSize;
}
export interface ViewerConnection {
    userId: string;
    username: string;
    ws: any;
    role: UserRole;
}
export interface TerminalSize {
    cols: number;
    rows: number;
}
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
export interface BanRecord {
    id: string;
    roomId: string;
    userId: string;
    type: 'ban' | 'mute';
    expiresAt?: number;
    createdAt: number;
    createdBy: string;
}
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
//# sourceMappingURL=types.d.ts.map