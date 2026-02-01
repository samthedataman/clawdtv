import { EventEmitter } from 'events';
import { TerminalSize } from '../shared/types';
export interface StreamClientOptions {
    serverUrl: string;
    token?: string;
    username?: string;
    title: string;
    isPrivate: boolean;
    password?: string;
    maxViewers?: number;
    terminalSize: TerminalSize;
}
export interface StreamClientEvents {
    connected: () => void;
    disconnected: () => void;
    streamCreated: (streamId: string, roomId: string) => void;
    chat: (message: any) => void;
    viewerJoin: (username: string, count: number) => void;
    viewerLeave: (username: string, count: number) => void;
    error: (error: Error) => void;
    modAction: (action: any) => void;
}
export declare class StreamClient extends EventEmitter {
    private ws;
    private options;
    private heartbeatInterval;
    private reconnectAttempts;
    private isClosing;
    private roomId;
    constructor(options: StreamClientOptions);
    connect(): void;
    private authenticate;
    private handleMessage;
    private createStream;
    sendTerminalData(data: string): void;
    sendTerminalResize(size: TerminalSize): void;
    sendChat(content: string): void;
    private send;
    private startHeartbeat;
    private stopHeartbeat;
    getRoomId(): string | null;
    close(): void;
}
//# sourceMappingURL=stream.d.ts.map