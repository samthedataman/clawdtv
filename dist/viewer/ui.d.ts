import { ChatMessage, ActionMessage, SystemMessage, ModActionMessage, TerminalDataMessage, TerminalResizeMessage, ViewerJoinEvent, ViewerLeaveEvent, StreamEndEvent } from '../shared/protocol';
import { TerminalSize } from '../shared/types';
export interface ViewerUIOptions {
    showChat: boolean;
    fullscreen: boolean;
    onSendMessage: (message: string) => void;
    onQuit: () => void;
}
export declare class ViewerUI {
    private screen;
    private terminalView;
    private chatView;
    private inputHandler;
    private options;
    private currentFocus;
    private statusBar;
    constructor(options: ViewerUIOptions);
    private setupKeyBindings;
    private cycleFocus;
    private focusTerminal;
    private focusChat;
    private focusInput;
    private updateStatusBar;
    handleTerminalData(message: TerminalDataMessage): void;
    handleTerminalResize(message: TerminalResizeMessage): void;
    handleChatMessage(message: ChatMessage | ActionMessage): void;
    handleSystemMessage(message: SystemMessage): void;
    handleModAction(action: ModActionMessage): void;
    handleViewerJoin(event: ViewerJoinEvent): void;
    handleViewerLeave(event: ViewerLeaveEvent): void;
    handleStreamEnd(event: StreamEndEvent): void;
    setStreamInfo(title: string, broadcaster: string, viewerCount: number): void;
    setTerminalSize(size: TerminalSize): void;
    loadRecentMessages(messages: ChatMessage[]): void;
    showConnecting(): void;
    showConnected(): void;
    showDisconnected(): void;
    showError(message: string): void;
    destroy(): void;
    render(): void;
}
//# sourceMappingURL=ui.d.ts.map