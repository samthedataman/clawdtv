import { UserRole, TerminalSize } from './types';
export interface BaseMessage {
    type: string;
    timestamp: number;
}
export interface TerminalDataMessage extends BaseMessage {
    type: 'terminal';
    data: string;
}
export interface TerminalResizeMessage extends BaseMessage {
    type: 'terminal_resize';
    size: TerminalSize;
}
export interface ChatMessage extends BaseMessage {
    type: 'chat';
    id: string;
    userId: string;
    username: string;
    content: string;
    role: UserRole;
}
export interface ActionMessage extends BaseMessage {
    type: 'action';
    id: string;
    userId: string;
    username: string;
    content: string;
    role: UserRole;
}
export interface SystemMessage extends BaseMessage {
    type: 'system';
    content: string;
}
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
export interface ModActionMessage extends BaseMessage {
    type: 'mod_action';
    action: 'ban' | 'mute' | 'unmute' | 'unban' | 'clear' | 'mod' | 'unmod' | 'slow';
    targetUserId?: string;
    targetUsername?: string;
    duration?: number;
    moderator: string;
}
export interface ViewerListMessage extends BaseMessage {
    type: 'viewer_list';
    viewers: Array<{
        userId: string;
        username: string;
        role: UserRole;
    }>;
    count: number;
}
export interface UptimeMessage extends BaseMessage {
    type: 'uptime';
    startedAt: number;
    duration: number;
}
export interface ErrorMessage extends BaseMessage {
    type: 'error';
    code: string;
    message: string;
}
export interface AuthRequestMessage extends BaseMessage {
    type: 'auth';
    token?: string;
    username?: string;
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
    terminalBuffer?: string;
}
export interface SendChatMessage extends BaseMessage {
    type: 'send_chat';
    content: string;
}
export interface HeartbeatMessage extends BaseMessage {
    type: 'heartbeat';
}
export interface HeartbeatAckMessage extends BaseMessage {
    type: 'heartbeat_ack';
}
export type ServerMessage = TerminalDataMessage | TerminalResizeMessage | ChatMessage | ActionMessage | SystemMessage | ViewerJoinEvent | ViewerLeaveEvent | StreamStartEvent | StreamEndEvent | ModActionMessage | ViewerListMessage | UptimeMessage | ErrorMessage | AuthResponseMessage | StreamCreatedMessage | JoinStreamResponseMessage | HeartbeatAckMessage;
export type ClientMessage = TerminalDataMessage | TerminalResizeMessage | SendChatMessage | AuthRequestMessage | CreateStreamMessage | JoinStreamMessage | HeartbeatMessage;
export declare function createMessage<T extends BaseMessage>(msg: Omit<T, 'timestamp'>): T;
export declare function isTerminalData(msg: any): msg is TerminalDataMessage;
export declare function isChatMessage(msg: any): msg is ChatMessage;
export declare function isAuthRequest(msg: any): msg is AuthRequestMessage;
export declare function isCreateStream(msg: any): msg is CreateStreamMessage;
export declare function isJoinStream(msg: any): msg is JoinStreamMessage;
export declare function isSendChat(msg: any): msg is SendChatMessage;
export declare function isHeartbeat(msg: any): msg is HeartbeatMessage;
export declare function isTerminalResize(msg: any): msg is TerminalResizeMessage;
//# sourceMappingURL=protocol.d.ts.map