"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewerUI = void 0;
const blessed = __importStar(require("blessed"));
const terminal_view_1 = require("./terminal-view");
const chat_view_1 = require("./chat-view");
const input_1 = require("./input");
const ascii_1 = require("../shared/ascii");
class ViewerUI {
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
            title: 'claude.tv',
            fullUnicode: true,
        });
        // Create terminal view
        this.terminalView = new terminal_view_1.TerminalView(this.screen);
        // Create chat view if enabled
        if (options.showChat) {
            this.chatView = new chat_view_1.ChatView(this.screen);
            // Create input handler
            this.inputHandler = new input_1.InputHandler(this.screen, {
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
        this.screen.title = `claude.tv - ${title} by ${broadcaster}`;
        this.chatView?.setViewerCount(viewerCount);
    }
    setTerminalSize(size) {
        this.terminalView.setTerminalSize(size);
    }
    loadRecentMessages(messages) {
        this.chatView?.loadMessages(messages);
    }
    showConnecting() {
        this.terminalView.appendData(ascii_1.CONNECTING);
    }
    showConnected() {
        this.terminalView.showConnected();
        this.terminalView.clear();
        this.terminalView.appendData(ascii_1.WELCOME_VIEWER);
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
exports.ViewerUI = ViewerUI;
//# sourceMappingURL=ui.js.map