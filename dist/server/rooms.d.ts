import { Room, Stream, TerminalSize, Agent } from '../shared/types';
import { ChatMessage, ViewerListMessage } from '../shared/protocol';
import { DatabaseService } from './database';
export declare class RoomManager {
    private rooms;
    private db;
    constructor(db: DatabaseService);
    createRoom(ownerId: string, ownerUsername: string, title: string, isPrivate: boolean, password?: string, maxViewers?: number, terminalSize?: TerminalSize): {
        room: Room;
        stream: Stream;
    };
    getRoom(roomId: string): Room | undefined;
    getRoomByStreamId(streamId: string): Room | undefined;
    setBroadcaster(roomId: string, userId: string, username: string, ws: any, terminalSize: TerminalSize): boolean;
    addViewer(roomId: string, userId: string, username: string, ws: any): {
        success: boolean;
        error?: string;
    };
    removeViewer(roomId: string, userId: string): void;
    removeBroadcaster(roomId: string): void;
    endRoom(roomId: string, reason?: string): void;
    createAgentRoom(roomId: string, stream: Stream, agent: Agent, terminalSize?: TerminalSize): Room;
    broadcastTerminalData(roomId: string, data: string): void;
    banUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): boolean;
    unbanUser(roomId: string, targetUserId: string): boolean;
    muteUser(roomId: string, targetUserId: string, moderatorId: string, duration?: number): boolean;
    unmuteUser(roomId: string, targetUserId: string): boolean;
    addMod(roomId: string, targetUserId: string, grantedBy: string): boolean;
    removeMod(roomId: string, targetUserId: string): boolean;
    setSlowMode(roomId: string, seconds: number): boolean;
    clearChat(roomId: string): boolean;
    canModerate(roomId: string, userId: string): boolean;
    isMuted(roomId: string, userId: string): boolean;
    canSendMessage(roomId: string, userId: string): {
        allowed: boolean;
        waitTime?: number;
    };
    recordMessage(roomId: string, userId: string): void;
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
    getRecentMessages(roomId: string): ChatMessage[];
}
//# sourceMappingURL=rooms.d.ts.map