import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  createMessage,
  AuthRequestMessage,
  CreateStreamMessage,
  TerminalDataMessage,
  TerminalResizeMessage,
  HeartbeatMessage,
  ServerMessage,
} from '../shared/protocol';
import { TerminalSize } from '../shared/types';
import {
  HEARTBEAT_INTERVAL,
  RECONNECT_DELAY,
  MAX_RECONNECT_ATTEMPTS,
} from '../shared/config';

export interface StreamClientOptions {
  serverUrl: string;
  token?: string;
  username?: string;
  title: string;
  isPrivate: boolean;
  password?: string;
  maxViewers?: number;
  terminalSize: TerminalSize;
}

export interface StreamClientEvents {
  connected: () => void;
  disconnected: () => void;
  streamCreated: (streamId: string, roomId: string) => void;
  chat: (message: any) => void;
  viewerJoin: (username: string, count: number) => void;
  viewerLeave: (username: string, count: number) => void;
  error: (error: Error) => void;
  modAction: (action: any) => void;
}

export class StreamClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: StreamClientOptions;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isClosing = false;
  private roomId: string | null = null;

  constructor(options: StreamClientOptions) {
    super();
    this.options = options;
  }

  connect(): void {
    this.isClosing = false;
    this.ws = new WebSocket(this.options.serverUrl);

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
      this.emit('disconnected');

      if (!this.isClosing && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), RECONNECT_DELAY);
      }
    });

    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private authenticate(): void {
    this.send(createMessage<AuthRequestMessage>({
      type: 'auth',
      token: this.options.token,
      username: this.options.username,
      role: 'broadcaster',
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
          this.createStream();
        } else {
          this.emit('error', new Error(message.error || 'Authentication failed'));
        }
        break;

      case 'stream_created':
        this.roomId = message.roomId;
        this.emit('connected');
        this.emit('streamCreated', message.streamId, message.roomId);
        break;

      case 'chat':
      case 'action':
        this.emit('chat', message);
        break;

      case 'viewer_join':
        this.emit('viewerJoin', message.username, message.viewerCount);
        break;

      case 'viewer_leave':
        this.emit('viewerLeave', message.username, message.viewerCount);
        break;

      case 'mod_action':
        this.emit('modAction', message);
        break;

      case 'error':
        this.emit('error', new Error(message.message));
        break;

      case 'heartbeat_ack':
        // Heartbeat acknowledged
        break;
    }
  }

  private createStream(): void {
    this.send(createMessage<CreateStreamMessage>({
      type: 'create_stream',
      title: this.options.title,
      isPrivate: this.options.isPrivate,
      password: this.options.password,
      maxViewers: this.options.maxViewers,
      terminalSize: this.options.terminalSize,
    }));
  }

  sendTerminalData(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(createMessage<TerminalDataMessage>({
        type: 'terminal',
        data,
      }));
    }
  }

  sendTerminalResize(size: TerminalSize): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(createMessage<TerminalResizeMessage>({
        type: 'terminal_resize',
        size,
      }));
    }
  }

  sendChat(content: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'send_chat',
        content,
        timestamp: Date.now(),
      });
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

  getRoomId(): string | null {
    return this.roomId;
  }

  close(): void {
    this.isClosing = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
