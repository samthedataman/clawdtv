import blessed from 'blessed';
import { TerminalSize } from '../shared/types.js';
export declare class TerminalView {
    private box;
    private content;
    private scrollback;
    private maxScrollback;
    private terminalSize;
    private screen;
    constructor(screen: blessed.Widgets.Screen);
    appendData(data: string): void;
    setTerminalSize(size: TerminalSize): void;
    clear(): void;
    scrollUp(): void;
    scrollDown(): void;
    scrollToTop(): void;
    scrollToBottom(): void;
    focus(): void;
    blur(): void;
    getElement(): blessed.Widgets.BoxElement;
    showDisconnected(): void;
    showConnected(): void;
    showStreamEnded(reason: string): void;
}
//# sourceMappingURL=terminal-view.d.ts.map