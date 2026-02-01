export interface ViewerOptions {
    serverUrl: string;
    token?: string;
    username?: string;
    roomId: string;
    password?: string;
    showChat: boolean;
    fullscreen: boolean;
}
export interface MultiViewerOptions {
    serverUrl: string;
    token?: string;
    username?: string;
    roomIds: string[];
    passwords?: Map<string, string>;
    showChat: boolean;
}
export declare class Viewer {
    private ws;
    private ui;
    private options;
    private heartbeatInterval;
    private reconnectAttempts;
    private isClosing;
    constructor(options: ViewerOptions);
    connect(): void;
    private authenticate;
    private handleMessage;
    private joinStream;
    private sendChat;
    private send;
    private startHeartbeat;
    private stopHeartbeat;
    close(): void;
}
export declare class MultiViewer {
    private client;
    private ui;
    private options;
    constructor(options: MultiViewerOptions);
    connect(): void;
    close(): void;
}
export { ViewerUI } from './ui';
export { TerminalView } from './terminal-view';
export { ChatView } from './chat-view';
export { InputHandler } from './input';
export { MultiViewerUI } from './multi-ui';
export { MultiStreamClient } from './multi-stream';
export { HomeScreen } from './home';
//# sourceMappingURL=index.d.ts.map