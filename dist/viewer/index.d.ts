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
export { ViewerUI } from './ui.js';
export { TerminalView } from './terminal-view.js';
export { ChatView } from './chat-view.js';
export { InputHandler } from './input.js';
export { MultiViewerUI } from './multi-ui.js';
export { MultiStreamClient } from './multi-stream.js';
export { HomeScreen } from './home.js';
//# sourceMappingURL=index.d.ts.map