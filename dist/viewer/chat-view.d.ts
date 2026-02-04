import * as blessed from 'blessed';
import { ChatMessage, ActionMessage, SystemMessage, ModActionMessage } from '../shared/protocol.js';
export declare class ChatView {
    private box;
    private messageList;
    private viewerCountLabel;
    private screen;
    private messages;
    private maxMessages;
    private viewerCount;
    private autoScroll;
    constructor(screen: blessed.Widgets.Screen);
    addMessage(message: ChatMessage | ActionMessage): void;
    addSystemMessage(message: SystemMessage): void;
    addModAction(action: ModActionMessage): void;
    addViewerJoin(username: string): void;
    addViewerLeave(username: string): void;
    setViewerCount(count: number): void;
    private formatChatMessage;
    private formatModAction;
    private getRoleTag;
    private escapeMarkup;
    private appendMessage;
    clearMessages(): void;
    loadMessages(messages: ChatMessage[]): void;
    scrollUp(): void;
    scrollDown(): void;
    scrollToBottom(): void;
    focus(): void;
    blur(): void;
    getElement(): blessed.Widgets.BoxElement;
}
//# sourceMappingURL=chat-view.d.ts.map