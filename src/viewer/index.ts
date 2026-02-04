import WebSocket from 'ws';
import { ViewerUI, ViewerUIOptions } from './ui.js';
import { MultiViewerUI } from './multi-ui.js';
import { MultiStreamClient } from './multi-stream.js';
import {
  createMessage,
  AuthRequestMessage,
  JoinStreamMessage,
  HeartbeatMessage,
  ServerMessage,
  SendChatMessage,
  ChatMessage,
} from '../shared/protocol.js';
import { parseServerUrl, HEARTBEAT_INTERVAL, RECONNECT_DELAY, MAX_RECONNECT_ATTEMPTS } from '../shared/config.js';

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

// Single stream viewer (original)
export class Viewer {
  private ws: WebSocket | null = null;
  private ui: ViewerUI;
  private options: ViewerOptions;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isClosing = false;

  constructor(options: ViewerOptions) {
    this.options = options;

    const uiOptions: ViewerUIOptions = {
      showChat: options.showChat,
      fullscreen: options.fullscreen,
      onSendMessage: (message) => this.sendChat(message),
      onQuit: () => this.close(),
    };

    this.ui = new ViewerUI(uiOptions);
  }

  connect(): void {
    this.isClosing = false;
    const { ws: wsUrl } = parseServerUrl(this.options.serverUrl);

    this.ui.showConnecting();
    this.ws = new WebSocket(`${wsUrl}/ws`);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.authenticate();
      this.startHeartbeat();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', () => {
      this.stopHeartbeat();
      this.ui.showDisconnected();

      if (!this.isClosing && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), RECONNECT_DELAY);
      }
    });

    this.ws.on('error', (error) => {
      this.ui.showError(error.message);
    });
  }

  private authenticate(): void {
    this.send(createMessage<AuthRequestMessage>({
      type: 'auth',
      token: this.options.token,
      username: this.options.username,
      role: 'viewer',
      roomId: this.options.roomId,
    }));
  }

  private handleMessage(data: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    switch (message.type) {
      case 'auth_response':
        if (message.success) {
          this.joinStream();
        } else {
          this.ui.showError(message.error || 'Authentication failed');
        }
        break;

      case 'join_stream_response':
        if (message.success && message.stream) {
          this.ui.showConnected();
          this.ui.setStreamInfo(
            message.stream.title,
            message.stream.broadcaster,
            message.stream.viewerCount
          );
          this.ui.setTerminalSize(message.stream.terminalSize);
          if (message.recentMessages) {
            this.ui.loadRecentMessages(message.recentMessages as ChatMessage[]);
          }
        } else {
          this.ui.showError(message.error || 'Failed to join stream');
        }
        break;

      case 'terminal':
        this.ui.handleTerminalData(message);
        break;

      case 'terminal_resize':
        this.ui.handleTerminalResize(message);
        break;

      case 'chat':
      case 'action':
        this.ui.handleChatMessage(message);
        break;

      case 'system':
        this.ui.handleSystemMessage(message);
        break;

      case 'mod_action':
        this.ui.handleModAction(message);
        break;

      case 'viewer_join':
        this.ui.handleViewerJoin(message);
        break;

      case 'viewer_leave':
        this.ui.handleViewerLeave(message);
        break;

      case 'stream_end':
        this.ui.handleStreamEnd(message);
        break;

      case 'error':
        this.ui.showError(message.message);
        break;

      case 'heartbeat_ack':
        // Heartbeat acknowledged
        break;
    }
  }

  private joinStream(): void {
    this.send(createMessage<JoinStreamMessage>({
      type: 'join_stream',
      roomId: this.options.roomId,
      password: this.options.password,
    }));
  }

  private sendChat(content: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(createMessage<SendChatMessage>({
        type: 'send_chat',
        content,
      }));
    }
  }

  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send(createMessage<HeartbeatMessage>({ type: 'heartbeat' }));
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  close(): void {
    this.isClosing = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.ui.destroy();
    process.exit(0);
  }
}

// Multi-stream viewer (new)
export class MultiViewer {
  private client: MultiStreamClient;
  private ui: MultiViewerUI;
  private options: MultiViewerOptions;

  constructor(options: MultiViewerOptions) {
    this.options = options;

    // Create UI
    this.ui = new MultiViewerUI({
      roomIds: options.roomIds,
      showChat: options.showChat,
      onSendMessage: (index, message) => this.client.sendChat(index, message),
      onQuit: () => this.close(),
    });

    // Create multi-stream client
    this.client = new MultiStreamClient({
      serverUrl: options.serverUrl,
      token: options.token,
      username: options.username,
      roomIds: options.roomIds,
      passwords: options.passwords,
      onTerminalData: (index, data) => this.ui.appendTerminalData(index, data),
      onChatMessage: (index, message) => this.ui.addChatMessage(index, message),
      onStreamInfo: (index, info) => {
        if (info) {
          this.ui.setStreamInfo(index, info.title, info.broadcaster, info.viewerCount);
        }
      },
      onViewerCount: (index, count) => this.ui.setViewerCount(index, count),
      onStreamEnd: (index, reason) => this.ui.setStreamEnded(index, reason),
      onError: (index, error) => this.ui.setError(index, error),
      onConnect: (index) => this.ui.setConnected(index),
      onDisconnect: (index) => this.ui.setDisconnected(index),
    });
  }

  connect(): void {
    this.client.connect();
  }

  close(): void {
    this.client.close();
    this.ui.destroy();
    process.exit(0);
  }
}

export { ViewerUI } from './ui.js';
export { TerminalView } from './terminal-view.js';
export { ChatView } from './chat-view.js';
export { InputHandler } from './input.js';
export { MultiViewerUI } from './multi-ui.js';
export { MultiStreamClient } from './multi-stream.js';
export { HomeScreen } from './home.js';
