import * as blessed from 'blessed';
import { TerminalView } from './terminal-view.js';
import { ChatView } from './chat-view.js';
import { InputHandler } from './input.js';
import { WELCOME_VIEWER, CONNECTING } from '../shared/ascii.js';
export class ViewerUI {
    screen;
    terminalView;
    chatView = null;
    inputHandler = null;
    options;
    currentFocus = 'input';
    statusBar;
    constructor(options) {
        this.options = options;
        // Create screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'clawdtv.com',
            fullUnicode: true,
        });
        // Create terminal view
        this.terminalView = new TerminalView(this.screen);
        // Create chat view if enabled
        if (options.showChat) {
            this.chatView = new ChatView(this.screen);
            // Create input handler
            this.inputHandler = new InputHandler(this.screen, {
                onSubmit: (text) => {
                    options.onSendMessage(text);
                },
                onEscape: () => {
                    this.focusTerminal();
                },
            });
            // Adjust terminal width
            this.terminalView.getElement().width = '70%';
        }
        else {
            // Full width terminal
            this.terminalView.getElement().width = '100%';
            this.terminalView.getElement().height = '100%';
        }
        // Create status bar
        this.statusBar = blessed.box({
            parent: this.screen,
            bottom: options.showChat ? 3 : 0,
            left: 0,
            width: '100%',
            height: 1,
            content: ' Tab: Switch focus | Ctrl+C: Quit | Page Up/Down: Scroll ',
            style: {
                fg: 'black',
                bg: 'cyan',
            },
        });
        this.setupKeyBindings();
        this.screen.render();
    }
    setupKeyBindings() {
        // Quit
        this.screen.key(['C-c'], () => {
            this.options.onQuit();
        });
        // Tab to switch focus
        this.screen.key(['tab'], () => {
            this.cycleFocus();
        });
        // Page up/down for scrolling
        this.screen.key(['pageup'], () => {
            if (this.currentFocus === 'terminal') {
                this.terminalView.scrollUp();
            }
            else if (this.currentFocus === 'chat' && this.chatView) {
                this.chatView.scrollUp();
            }
        });
        this.screen.key(['pagedown'], () => {
            if (this.currentFocus === 'terminal') {
                this.terminalView.scrollDown();
            }
            else if (this.currentFocus === 'chat' && this.chatView) {
                this.chatView.scrollDown();
            }
        });
        // Home/End for scroll to top/bottom
        this.screen.key(['home'], () => {
            if (this.currentFocus === 'terminal') {
                this.terminalView.scrollToTop();
            }
        });
        this.screen.key(['end'], () => {
            if (this.currentFocus === 'terminal') {
                this.terminalView.scrollToBottom();
            }
            else if (this.currentFocus === 'chat' && this.chatView) {
                this.chatView.scrollToBottom();
            }
        });
    }
    cycleFocus() {
        if (!this.options.showChat) {
            return;
        }
        switch (this.currentFocus) {
            case 'input':
                this.focusTerminal();
                break;
            case 'terminal':
                this.focusChat();
                break;
            case 'chat':
                this.focusInput();
                break;
        }
    }
    focusTerminal() {
        this.currentFocus = 'terminal';
        this.terminalView.focus();
        this.chatView?.blur();
        this.inputHandler?.blur();
        this.updateStatusBar();
    }
    focusChat() {
        if (!this.chatView)
            return;
        this.currentFocus = 'chat';
        this.terminalView.blur();
        this.chatView.focus();
        this.inputHandler?.blur();
        this.updateStatusBar();
    }
    focusInput() {
        if (!this.inputHandler)
            return;
        this.currentFocus = 'input';
        this.terminalView.blur();
        this.chatView?.blur();
        this.inputHandler.focus();
        this.updateStatusBar();
    }
    updateStatusBar() {
        const focusText = `Focus: ${this.currentFocus}`;
        this.statusBar.setContent(` Tab: Switch focus | Ctrl+C: Quit | Page Up/Down: Scroll | ${focusText} `);
        this.screen.render();
    }
    // Public methods for handling stream events
    handleTerminalData(message) {
        this.terminalView.appendData(message.data);
    }
    handleTerminalResize(message) {
        this.terminalView.setTerminalSize(message.size);
    }
    handleChatMessage(message) {
        this.chatView?.addMessage(message);
    }
    handleSystemMessage(message) {
        this.chatView?.addSystemMessage(message);
    }
    handleModAction(action) {
        this.chatView?.addModAction(action);
    }
    handleViewerJoin(event) {
        this.chatView?.addViewerJoin(event.username);
        this.chatView?.setViewerCount(event.viewerCount);
    }
    handleViewerLeave(event) {
        this.chatView?.addViewerLeave(event.username);
        this.chatView?.setViewerCount(event.viewerCount);
    }
    handleStreamEnd(event) {
        this.terminalView.showStreamEnded(event.reason);
        this.inputHandler?.disable();
    }
    setStreamInfo(title, broadcaster, viewerCount) {
        this.screen.title = `clawdtv.com - ${title} by ${broadcaster}`;
        this.chatView?.setViewerCount(viewerCount);
    }
    setTerminalSize(size) {
        this.terminalView.setTerminalSize(size);
    }
    loadRecentMessages(messages) {
        this.chatView?.loadMessages(messages);
    }
    showConnecting() {
        this.terminalView.appendData(CONNECTING);
    }
    showConnected() {
        this.terminalView.showConnected();
        this.terminalView.clear();
        this.terminalView.appendData(WELCOME_VIEWER);
        this.terminalView.appendData('\n\x1b[90m─────────────────────────────────────────────────────────────────────\x1b[0m\n\n');
        if (this.inputHandler) {
            this.inputHandler.focus();
        }
    }
    showDisconnected() {
        this.terminalView.showDisconnected();
    }
    showError(message) {
        this.terminalView.appendData(`\n\x1b[31mError: ${message}\x1b[0m\n`);
    }
    destroy() {
        this.screen.destroy();
    }
    render() {
        this.screen.render();
    }
}
//# sourceMappingURL=ui.js.map