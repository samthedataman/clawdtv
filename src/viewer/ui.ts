import * as blessed from 'blessed';
import { TerminalView } from './terminal-view';
import { ChatView } from './chat-view';
import { InputHandler } from './input';
import {
  ChatMessage,
  ActionMessage,
  SystemMessage,
  ModActionMessage,
  TerminalDataMessage,
  TerminalResizeMessage,
  ViewerJoinEvent,
  ViewerLeaveEvent,
  StreamEndEvent,
} from '../shared/protocol';
import { TerminalSize } from '../shared/types';
import { WELCOME_VIEWER, STREAM_ENDED, CONNECTING } from '../shared/ascii';

export interface ViewerUIOptions {
  showChat: boolean;
  fullscreen: boolean;
  onSendMessage: (message: string) => void;
  onQuit: () => void;
}

type FocusArea = 'terminal' | 'chat' | 'input';

export class ViewerUI {
  private screen: blessed.Widgets.Screen;
  private terminalView: TerminalView;
  private chatView: ChatView | null = null;
  private inputHandler: InputHandler | null = null;
  private options: ViewerUIOptions;
  private currentFocus: FocusArea = 'input';
  private statusBar: blessed.Widgets.BoxElement;

  constructor(options: ViewerUIOptions) {
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
    } else {
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

  private setupKeyBindings(): void {
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
      } else if (this.currentFocus === 'chat' && this.chatView) {
        this.chatView.scrollUp();
      }
    });

    this.screen.key(['pagedown'], () => {
      if (this.currentFocus === 'terminal') {
        this.terminalView.scrollDown();
      } else if (this.currentFocus === 'chat' && this.chatView) {
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
      } else if (this.currentFocus === 'chat' && this.chatView) {
        this.chatView.scrollToBottom();
      }
    });
  }

  private cycleFocus(): void {
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

  private focusTerminal(): void {
    this.currentFocus = 'terminal';
    this.terminalView.focus();
    this.chatView?.blur();
    this.inputHandler?.blur();
    this.updateStatusBar();
  }

  private focusChat(): void {
    if (!this.chatView) return;
    this.currentFocus = 'chat';
    this.terminalView.blur();
    this.chatView.focus();
    this.inputHandler?.blur();
    this.updateStatusBar();
  }

  private focusInput(): void {
    if (!this.inputHandler) return;
    this.currentFocus = 'input';
    this.terminalView.blur();
    this.chatView?.blur();
    this.inputHandler.focus();
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const focusText = `Focus: ${this.currentFocus}`;
    this.statusBar.setContent(` Tab: Switch focus | Ctrl+C: Quit | Page Up/Down: Scroll | ${focusText} `);
    this.screen.render();
  }

  // Public methods for handling stream events

  handleTerminalData(message: TerminalDataMessage): void {
    this.terminalView.appendData(message.data);
  }

  handleTerminalResize(message: TerminalResizeMessage): void {
    this.terminalView.setTerminalSize(message.size);
  }

  handleChatMessage(message: ChatMessage | ActionMessage): void {
    this.chatView?.addMessage(message);
  }

  handleSystemMessage(message: SystemMessage): void {
    this.chatView?.addSystemMessage(message);
  }

  handleModAction(action: ModActionMessage): void {
    this.chatView?.addModAction(action);
  }

  handleViewerJoin(event: ViewerJoinEvent): void {
    this.chatView?.addViewerJoin(event.username);
    this.chatView?.setViewerCount(event.viewerCount);
  }

  handleViewerLeave(event: ViewerLeaveEvent): void {
    this.chatView?.addViewerLeave(event.username);
    this.chatView?.setViewerCount(event.viewerCount);
  }

  handleStreamEnd(event: StreamEndEvent): void {
    this.terminalView.showStreamEnded(event.reason);
    this.inputHandler?.disable();
  }

  setStreamInfo(title: string, broadcaster: string, viewerCount: number): void {
    this.screen.title = `clawdtv.com - ${title} by ${broadcaster}`;
    this.chatView?.setViewerCount(viewerCount);
  }

  setTerminalSize(size: TerminalSize): void {
    this.terminalView.setTerminalSize(size);
  }

  loadRecentMessages(messages: ChatMessage[]): void {
    this.chatView?.loadMessages(messages);
  }

  showConnecting(): void {
    this.terminalView.appendData(CONNECTING);
  }

  showConnected(): void {
    this.terminalView.showConnected();
    this.terminalView.clear();
    this.terminalView.appendData(WELCOME_VIEWER);
    this.terminalView.appendData('\n\x1b[90m─────────────────────────────────────────────────────────────────────\x1b[0m\n\n');
    if (this.inputHandler) {
      this.inputHandler.focus();
    }
  }

  showDisconnected(): void {
    this.terminalView.showDisconnected();
  }

  showError(message: string): void {
    this.terminalView.appendData(`\n\x1b[31mError: ${message}\x1b[0m\n`);
  }

  destroy(): void {
    this.screen.destroy();
  }

  render(): void {
    this.screen.render();
  }
}
