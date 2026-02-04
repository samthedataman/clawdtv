import WebSocket from 'ws';
import {
  createMessage,
  AuthRequestMessage,
  JoinStreamMessage,
  HeartbeatMessage,
  ServerMessage,
  SendChatMessage,
  ChatMessage,
} from '../shared/protocol.js';
import { parseServerUrl, HEARTBEAT_INTERVAL } from '../shared/config.js';
import { TerminalSize } from '../shared/types.js';

export interface StreamConnection {
  roomId: string;
  ws: WebSocket | null;
  connected: boolean;
  streamInfo?: {
    title: string;
    broadcaster: string;
    viewerCount: number;
    terminalSize: TerminalSize;
  };
  terminalBuffer: string;
  chatMessages: ChatMessage[];
  error?: string;
}

export interface MultiStreamClientOptions {
  serverUrl: string;
  token?: string;
  username?: string;
  roomIds: string[];
  passwords?: Map<string, string>;
  onTerminalData: (index: number, data: string) => void;
  onChatMessage: (index: number, message: any) => void;
  onStreamInfo: (index: number, info: StreamConnection['streamInfo']) => void;
  onViewerCount: (index: number, count: number) => void;
  onStreamEnd: (index: number, reason: string) => void;
  onError: (index: number, error: string) => void;
  onConnect: (index: number) => void;
  onDisconnect: (index: number) => void;
}

export class MultiStreamClient {
  private connections: StreamConnection[] = [];
  private options: MultiStreamClientOptions;
  private heartbeatIntervals: Map<number, NodeJS.Timeout> = new Map();

  constructor(options: MultiStreamClientOptions) {
    this.options = options;

    // Initialize connections for each room
    for (const roomId of options.roomIds) {
      this.connections.push({
        roomId,
        ws: null,
        connected: false,
        terminalBuffer: '',
        chatMessages: [],
      });
    }
  }

  connect(): void {
    const { ws: wsUrl } = parseServerUrl(this.options.serverUrl);

    this.connections.forEach((conn, index) => {
      this.connectStream(index, wsUrl);
    });
  }

  private connectStream(index: number, wsUrl: string): void {
    const conn = this.connections[index];
    conn.ws = new WebSocket(`${wsUrl}/ws`);

    conn.ws.on('open', () => {
      this.authenticate(index);
      this.startHeartbeat(index);
    });

    conn.ws.on('message', (data) => {
      this.handleMessage(index, data.toString());
    });

    conn.ws.on('close', () => {
      this.stopHeartbeat(index);
      conn.connected = false;
      this.options.onDisconnect(index);
    });

    conn.ws.on('error', (error) => {
      conn.error = error.message;
      this.options.onError(index, error.message);
    });
  }

  private authenticate(index: number): void {
    const conn = this.connections[index];
    this.send(index, createMessage<AuthRequestMessage>({
      type: 'auth',
      token: this.options.token,
      username: this.options.username,
      role: 'viewer',
      roomId: conn.roomId,
    }));
  }

  private handleMessage(index: number, data: string): void {
    const conn = this.connections[index];
    let message: ServerMessage;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    switch (message.type) {
      case 'auth_response':
        if (message.success) {
          this.joinStream(index);
        } else {
          conn.error = message.error || 'Authentication failed';
          this.options.onError(index, conn.error);
        }
        break;

      case 'join_stream_response':
        if (message.success && message.stream) {
          conn.connected = true;
          conn.streamInfo = {
            title: message.stream.title,
            broadcaster: message.stream.broadcaster,
            viewerCount: message.stream.viewerCount,
            terminalSize: message.stream.terminalSize,
          };
          this.options.onConnect(index);
          this.options.onStreamInfo(index, conn.streamInfo);

          // Load recent messages
          if (message.recentMessages) {
            conn.chatMessages = message.recentMessages as ChatMessage[];
            for (const msg of conn.chatMessages) {
              this.options.onChatMessage(index, msg);
            }
          }
        } else {
          conn.error = message.error || 'Failed to join stream';
          this.options.onError(index, conn.error);
        }
        break;

      case 'terminal':
        conn.terminalBuffer += message.data;
        // Keep buffer reasonable size
        if (conn.terminalBuffer.length > 500000) {
          conn.terminalBuffer = conn.terminalBuffer.slice(-250000);
        }
        this.options.onTerminalData(index, message.data);
        break;

      case 'terminal_resize':
        if (conn.streamInfo) {
          conn.streamInfo.terminalSize = message.size;
        }
        break;

      case 'chat':
      case 'action':
        conn.chatMessages.push(message as ChatMessage);
        if (conn.chatMessages.length > 200) {
          conn.chatMessages.shift();
        }
        this.options.onChatMessage(index, message);
        break;

      case 'viewer_join':
      case 'viewer_leave':
        if (conn.streamInfo) {
          conn.streamInfo.viewerCount = message.viewerCount;
        }
        this.options.onViewerCount(index, message.viewerCount);
        this.options.onChatMessage(index, message);
        break;

      case 'stream_end':
        conn.connected = false;
        this.options.onStreamEnd(index, message.reason);
        break;

      case 'error':
        this.options.onError(index, message.message);
        break;

      case 'system':
      case 'mod_action':
        this.options.onChatMessage(index, message);
        break;

      case 'heartbeat_ack':
        break;
    }
  }

  private joinStream(index: number): void {
    const conn = this.connections[index];
    const password = this.options.passwords?.get(conn.roomId);

    this.send(index, createMessage<JoinStreamMessage>({
      type: 'join_stream',
      roomId: conn.roomId,
      password,
    }));
  }

  sendChat(index: number, content: string): void {
    const conn = this.connections[index];
    if (conn.ws?.readyState === WebSocket.OPEN) {
      this.send(index, createMessage<SendChatMessage>({
        type: 'send_chat',
        content,
      }));
    }
  }

  private send(index: number, message: any): void {
    const conn = this.connections[index];
    if (conn.ws?.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(index: number): void {
    const interval = setInterval(() => {
      this.send(index, createMessage<HeartbeatMessage>({ type: 'heartbeat' }));
    }, HEARTBEAT_INTERVAL);
    this.heartbeatIntervals.set(index, interval);
  }

  private stopHeartbeat(index: number): void {
    const interval = this.heartbeatIntervals.get(index);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(index);
    }
  }

  getConnection(index: number): StreamConnection | undefined {
    return this.connections[index];
  }

  getConnectionCount(): number {
    return this.connections.length;
  }

  getTerminalBuffer(index: number): string {
    return this.connections[index]?.terminalBuffer || '';
  }

  close(): void {
    this.connections.forEach((conn, index) => {
      this.stopHeartbeat(index);
      if (conn.ws) {
        conn.ws.close();
        conn.ws = null;
      }
    });
  }
}
