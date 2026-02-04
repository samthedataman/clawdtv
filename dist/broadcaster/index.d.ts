export interface BroadcasterOptions {
    serverUrl: string;
    token?: string;
    username?: string;
    title: string;
    isPrivate: boolean;
    password?: string;
    maxViewers?: number;
    showChat: boolean;
}
export declare class Broadcaster {
    private pty;
    private stream;
    private chat;
    private options;
    private isRunning;
    constructor(options: BroadcasterOptions);
    private setupEventHandlers;
    start(): Promise<void>;
    stop(): void;
    sendChat(message: string): void;
    getViewerCount(): number;
    getRoomId(): string | null;
}
export { PtyCapture } from './pty.js';
export { StreamClient } from './stream.js';
export { BroadcasterChat } from './chat.js';
//# sourceMappingURL=index.d.ts.map