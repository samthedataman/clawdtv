import { User, UserPublic, Stream, ChatMessageDB, BanRecord, UserRole, Agent, AgentPublic, AgentStream } from '../shared/types.js';
export declare class DatabaseService {
    private pool;
    constructor(connectionString?: string);
    init(): Promise<void>;
    createUser(username: string, passwordHash: string, displayName?: string): Promise<User>;
    getUserById(id: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    updateUser(id: string, updates: {
        displayName?: string;
    }): Promise<boolean>;
    toUserPublic(user: User): UserPublic;
    createStream(ownerId: string, title: string, isPrivate: boolean, password?: string, maxViewers?: number): Promise<Stream>;
    getStreamById(id: string): Promise<Stream | null>;
    getActiveStreams(): Promise<Stream[]>;
    getPublicActiveStreams(): Promise<Stream[]>;
    endStream(id: string): Promise<boolean>;
    saveMessage(roomId: string, userId: string, username: string, content: string, role: UserRole): Promise<ChatMessageDB>;
    getRecentMessages(roomId: string, limit?: number): Promise<ChatMessageDB[]>;
    clearRoomMessages(roomId: string): Promise<number>;
    addBan(roomId: string, userId: string, type: 'ban' | 'mute', createdBy: string, duration?: number): Promise<BanRecord>;
    removeBan(roomId: string, userId: string, type: 'ban' | 'mute'): Promise<boolean>;
    isUserBanned(roomId: string, userId: string): Promise<boolean>;
    isUserMuted(roomId: string, userId: string): Promise<boolean>;
    getActiveBans(roomId: string): Promise<BanRecord[]>;
    cleanExpiredBans(): Promise<number>;
    addMod(roomId: string, userId: string, grantedBy: string): Promise<void>;
    removeMod(roomId: string, userId: string): Promise<boolean>;
    isMod(roomId: string, userId: string): Promise<boolean>;
    getRoomMods(roomId: string): Promise<string[]>;
    createAgent(name: string): Promise<Agent>;
    getAgentByApiKey(apiKey: string): Promise<Agent | null>;
    getAgentById(id: string): Promise<Agent | null>;
    getAllAgents(): Promise<Agent[]>;
    getRecentAgents(limit?: number): Promise<Agent[]>;
    updateAgentLastSeen(id: string): Promise<void>;
    claimAgent(agentId: string, humanUsername: string): Promise<boolean>;
    incrementAgentStreamCount(agentId: string): Promise<void>;
    incrementAgentViewers(agentId: string, count: number): Promise<void>;
    createAgentStream(agentId: string, roomId: string, title: string, cols?: number, rows?: number): Promise<AgentStream>;
    getActiveAgentStream(agentId: string): Promise<AgentStream | null>;
    getActiveAgentStreams(): Promise<AgentStream[]>;
    getActiveAgentStreamsWithAgentInfo(): Promise<Array<AgentStream & {
        agentName: string;
        verified: boolean;
    }>>;
    endAgentStream(streamId: string): Promise<boolean>;
    endStaleAgentStreams(inactivityThresholdMs?: number): Promise<number>;
    getAgentStreamByRoomId(roomId: string): Promise<AgentStream | null>;
    getEndedAgentStreams(limit?: number, offset?: number): Promise<{
        streams: AgentStream[];
        total: number;
    }>;
    getEndedStreams(limit?: number, offset?: number): Promise<{
        streams: Stream[];
        total: number;
    }>;
    getAllMessagesForRoom(roomId: string, limit?: number, offset?: number): Promise<{
        messages: ChatMessageDB[];
        total: number;
    }>;
    getAgentStreamsByAgentId(agentId: string, limit?: number, offset?: number): Promise<{
        streams: AgentStream[];
        total: number;
    }>;
    toAgentPublic(agent: Agent, isStreaming?: boolean): AgentPublic;
    /**
     * Delete old ended streams and their associated chat messages.
     * @param maxAgeDays - Delete streams ended more than this many days ago (default: 30)
     */
    cleanupOldStreams(maxAgeDays?: number): Promise<{
        streams: number;
        agentStreams: number;
        messages: number;
    }>;
    /**
     * Delete orphaned chat messages (messages with no associated stream).
     */
    cleanupOrphanedMessages(): Promise<number>;
    /**
     * Run all cleanup jobs. Call this periodically (e.g., once per hour or daily).
     */
    runCleanupJobs(maxAgeDays?: number): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map