export interface StreamTab {
    index: number;
    roomId: string;
    title: string;
    broadcaster: string;
    viewerCount: number;
    connected: boolean;
    error?: string;
    terminalContent: string;
    chatMessages: Array<{
        formatted: string;
        raw: any;
    }>;
}
export interface MultiViewerUIOptions {
    roomIds: string[];
    showChat: boolean;
    onSendMessage: (streamIndex: number, message: string) => void;
    onQuit: () => void;
}
export declare class MultiViewerUI {
    private screen;
    private options;
    private tabs;
    private activeTabIndex;
    private tabBar;
    private terminalBox;
    private chatBox;
    private chatMessages;
    private inputBox;
    private statusBar;
    constructor(options: MultiViewerUIOptions);
    private createTabBar;
    private createTerminalBox;
    private createChatBox;
    private createInputBox;
    private createStatusBar;
    private setupKeyBindings;
    private switchToTab;
    private updateTabBar;
    private updateLabels;
    private refreshTerminal;
    private refreshChat;
    setStreamInfo(index: number, title: string, broadcaster: string, viewerCount: number): void;
    appendTerminalData(index: number, data: string): void;
    addChatMessage(index: number, message: any): void;
    setViewerCount(index: number, count: number): void;
    setConnected(index: number): void;
    setDisconnected(index: number): void;
    setError(index: number, error: string): void;
    setStreamEnded(index: number, reason: string): void;
    private formatMessage;
    private getRoleTag;
    private escapeMarkup;
    destroy(): void;
    render(): void;
}
//# sourceMappingURL=multi-ui.d.ts.map