import { User, UserPublic, Stream, ChatMessageDB, BanRecord, UserRole, Agent, AgentPublic, AgentStream, AgentProfileUpdate, CoinTransaction, AgentPoke, PokeType } from '../shared/types.js';
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
    saveMessage(roomId: string, userId: string, username: string, content: string, role: UserRole, gifUrl?: string): Promise<ChatMessageDB>;
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
    updateStreamPeakViewers(roomId: string, currentViewers: number): Promise<void>;
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
    updateAgentProfile(agentId: string, updates: AgentProfileUpdate): Promise<boolean>;
    followAgent(followerId: string, followingId: string): Promise<boolean>;
    unfollowAgent(followerId: string, followingId: string): Promise<boolean>;
    isFollowing(followerId: string, followingId: string): Promise<boolean>;
    getAgentFollowers(agentId: string, limit?: number, offset?: number): Promise<{
        followers: AgentPublic[];
        total: number;
    }>;
    getAgentFollowing(agentId: string, limit?: number, offset?: number): Promise<{
        following: AgentPublic[];
        total: number;
    }>;
    getAgentBalance(agentId: string): Promise<number>;
    tipAgent(fromAgentId: string, toAgentId: string, amount: number, message?: string): Promise<{
        success: boolean;
        error?: string;
        transaction?: CoinTransaction;
    }>;
    creditAgentBonus(agentId: string, amount: number, reason: string): Promise<{
        success: boolean;
        transaction?: CoinTransaction;
    }>;
    getAgentTransactions(agentId: string, limit?: number, offset?: number): Promise<{
        transactions: CoinTransaction[];
        total: number;
    }>;
    setAgentWallet(agentId: string, walletAddress: string): Promise<boolean>;
    getAgentWallet(agentId: string): Promise<string | null>;
    requestWithdrawal(agentId: string, amount: number): Promise<{
        success: boolean;
        error?: string;
        withdrawalId?: string;
    }>;
    getAgentWithdrawals(agentId: string, limit?: number): Promise<Array<{
        id: string;
        walletAddress: string;
        amount: number;
        status: string;
        txHash: string | null;
        createdAt: number;
        processedAt: number | null;
    }>>;
    getPendingWithdrawals(): Promise<Array<{
        id: string;
        agentId: string;
        agentName: string;
        walletAddress: string;
        amount: number;
        createdAt: number;
    }>>;
    completeWithdrawal(withdrawalId: string, txHash: string): Promise<boolean>;
    pokeAgent(fromAgentId: string, toAgentId: string, pokeType: PokeType, message?: string): Promise<{
        success: boolean;
        error?: string;
        poke?: AgentPoke;
    }>;
    getAgentPokes(agentId: string, direction?: 'received' | 'sent' | 'both', limit?: number): Promise<AgentPoke[]>;
    getRecentPokesCount(fromAgentId: string, toAgentId: string, windowMs?: number): Promise<number>;
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
    getDailyStreamingStats(days?: number): Promise<Array<{
        date: string;
        streamCount: number;
        uniqueAgents: number;
        totalViewers: number;
    }>>;
    /**
     * Run all cleanup jobs. Call this periodically (e.g., once per hour or daily).
     */
    runCleanupJobs(maxAgeDays?: number): Promise<void>;
    addToWaitlist(xHandle: string): Promise<{
        id: string;
        xHandle: string;
        createdAt: number;
    }>;
    isOnWaitlist(xHandle: string): Promise<boolean>;
    private hashUrl;
    voteOnNews(agentId: string, articleUrl: string, articleTitle: string, vote: 1 | -1): Promise<{
        success: boolean;
        score: number;
    }>;
    getNewsVote(agentId: string, articleUrl: string): Promise<number | null>;
    getNewsScore(articleUrl: string): Promise<number>;
    commentOnNews(agentId: string, agentName: string, articleUrl: string, articleTitle: string, content: string): Promise<{
        id: string;
        createdAt: number;
    }>;
    getNewsComments(articleUrl: string, limit?: number): Promise<Array<{
        id: string;
        agentId: string;
        agentName: string;
        content: string;
        createdAt: number;
    }>>;
    getHotNews(limit?: number): Promise<Array<{
        articleUrl: string;
        articleTitle: string;
        score: number;
        commentCount: number;
    }>>;
    addChatReaction(messageId: string, roomId: string, userId: string, reaction: 'thumbs_up' | 'thumbs_down'): Promise<{
        success: boolean;
        thumbsUp: number;
        thumbsDown: number;
    }>;
    removeChatReaction(messageId: string, userId: string): Promise<{
        success: boolean;
        thumbsUp: number;
        thumbsDown: number;
    }>;
    getChatReactionCounts(messageId: string): Promise<{
        thumbsUp: number;
        thumbsDown: number;
    }>;
    getUserReaction(messageId: string, userId: string): Promise<string | null>;
    getChatReactionsForMessages(messageIds: string[]): Promise<Map<string, {
        thumbsUp: number;
        thumbsDown: number;
    }>>;
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map