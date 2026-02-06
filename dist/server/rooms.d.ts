import { Room, Stream, TerminalSize, Agent, SSESubscriber, RoomRulesEntry, PendingJoinRequest } from '../shared/types.js';
import { ChatMessage, ViewerListMessage } from '../shared/protocol.js';
import { DatabaseService } from './database.js';
export declare class RoomManager {
    private rooms;
    private db;
    private cleanupInterval;
    private deepCleanupInterval;
    private sseSubscribers;
    readonly roomRules: Map<string, RoomRulesEntry>;
    readonly pendingJoinRequests: Map<string, PendingJoinRequest[]>;
    constructor(db: DatabaseService);
    private startCleanupInterval;
    private startDeepCleanupInterval;
    private cleanupInactiveRooms;
    updateActivity(roomId: string): void;
    stopCleanup(): void;
    addSSESubscriber(roomId: string, subscriber: SSESubscriber): void;
    removeSSESubscriber(roomId: string, agentId: string): void;
    broadcastSSE(roomId: string, eventType: string, data: any, excludeAgentId?: string): void;
    clearSSESubscribers(roomId: string): void;
    getSSESubscriberCount(roomId: string): number;
    hasSSESubscriber(roomId: string, agentId: string): boolean;
    createRoom(ownerId: string, ownerUsername: string, title: string, isPrivate: boolean, password?: string, maxViewers?: number, terminalSize?: TerminalSize): Promise<{
        room: Room;
        stream: Stream;
    }>;
    getRoom(roomId: string): Room | undefined;
    getRoomByStreamId(streamId: string): Room | undefined;
    setBroadcaster(roomId: string, userId: string, username: string, ws: any, terminalSize: TerminalSize): boolean;
    addViewer(roomId: string, userId: string, username: string, ws: any): {
        success: boolean;
        error?: string;
    };
    private updateStreamStats;
    removeViewer(roomId: string, userId: string): void;
    removeBroadcaster(roomId: string): void;
    endRoom(roomId: string, reason?: string): Promise<void>;
    createAgentRoom(roomId: string, stream: Stream, agent: Agent, terminalSize?: TerminalSize): Room;
    broadcastTerminalData(roomId: string, data: string): void;
    getTerminalBuffer(roomId: string): string;
    banUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): Promise<boolean>;
    unbanUser(roomId: string, targetUserId: string): Promise<boolean>;
    muteUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): Promise<boolean>;
    unmuteUser(roomId: string, targetUserId: string): Promise<boolean>;
    addMod(roomId: string, targetUserId: string, grantedBy: string): Promise<boolean>;
    removeMod(roomId: string, targetUserId: string): Promise<boolean>;
    setSlowMode(roomId: string, seconds: number): boolean;
    clearChat(roomId: string): Promise<boolean>;
    canModerate(roomId: string, userId: string): boolean;
    isMuted(roomId: string, userId: string): boolean;
    canSendMessage(roomId: string, userId: string): {
        allowed: boolean;
        waitTime?: number;
    };
    recordMessage(roomId: string, userId: string): void;
    isDuplicateMessage(roomId: string, content: string): boolean;
    recordMessageContent(roomId: string, content: string): void;
    getViewerList(roomId: string): ViewerListMessage;
    broadcastToRoom(roomId: string, message: any, excludeUserId?: string): void;
    broadcastToBroadcaster(roomId: string, message: any): void;
    getActiveRooms(): Array<{
        id: string;
        title: string;
        ownerId: string;
        ownerUsername: string;
        viewerCount: number;
        isPrivate: boolean;
        hasPassword: boolean;
        startedAt: number;
    }>;
    getRecentMessages(roomId: string): Promise<ChatMessage[]>;
    addAgentViewer(roomId: string, agentId: string, agentName: string): boolean;
    removeAgentViewer(roomId: string, agentId: string): void;
}
//# sourceMappingURL=rooms.d.ts.map