import { ChatMessage, ActionMessage, ModActionMessage } from '../shared/protocol.js';
export interface ChatOverlayOptions {
    enabled: boolean;
    maxMessages: number;
    position: 'top' | 'bottom';
}
export declare class BroadcasterChat {
    private messages;
    private viewerCount;
    private options;
    private onMessage?;
    constructor(options?: Partial<ChatOverlayOptions>);
    setMessageHandler(handler: (formatted: string) => void): void;
    handleChatMessage(message: ChatMessage | ActionMessage): void;
    handleViewerJoin(username: string, count: number): void;
    handleViewerLeave(username: string, count: number): void;
    handleModAction(action: ModActionMessage): void;
    private formatMessage;
    private formatModAction;
    private getRoleColor;
    getViewerCount(): number;
    getRecentMessages(): Array<ChatMessage | ActionMessage>;
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
}
//# sourceMappingURL=chat.d.ts.map