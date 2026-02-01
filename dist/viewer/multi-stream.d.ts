import WebSocket from 'ws';
import { ChatMessage } from '../shared/protocol';
import { TerminalSize } from '../shared/types';
export interface StreamConnection {
    roomId: string;
    ws: WebSocket | null;
    connected: boolean;
    streamInfo?: {
        title: string;
        broadcaster: string;
        viewerCount: number;
        terminalSize: TerminalSize;
    };
    terminalBuffer: string;
    chatMessages: ChatMessage[];
    error?: string;
}
export interface MultiStreamClientOptions {
    serverUrl: string;
    token?: string;
    username?: string;
    roomIds: string[];
    passwords?: Map<string, string>;
    onTerminalData: (index: number, data: string) => void;
    onChatMessage: (index: number, message: any) => void;
    onStreamInfo: (index: number, info: StreamConnection['streamInfo']) => void;
    onViewerCount: (index: number, count: number) => void;
    onStreamEnd: (index: number, reason: string) => void;
    onError: (index: number, error: string) => void;
    onConnect: (index: number) => void;
    onDisconnect: (index: number) => void;
}
export declare class MultiStreamClient {
    private connections;
    private options;
    private heartbeatIntervals;
    constructor(options: MultiStreamClientOptions);
    connect(): void;
    private connectStream;
    private authenticate;
    private handleMessage;
    private joinStream;
    sendChat(index: number, content: string): void;
    private send;
    private startHeartbeat;
    private stopHeartbeat;
    getConnection(index: number): StreamConnection | undefined;
    getConnectionCount(): number;
    getTerminalBuffer(index: number): string;
    close(): void;
}
//# sourceMappingURL=multi-stream.d.ts.map