import { PtyCapture } from './pty';
import { StreamClient, StreamClientOptions } from './stream';
import { BroadcasterChat } from './chat';
import { parseServerUrl } from '../shared/config';
import { LOGO, WELCOME_STREAMER, STREAM_STARTED, GOODBYE } from '../shared/ascii';

export interface BroadcasterOptions {
  serverUrl: string;
  token?: string;
  username?: string;
  title: string;
  isPrivate: boolean;
  password?: string;
  maxViewers?: number;
  showChat: boolean;
}

export class Broadcaster {
  private pty: PtyCapture;
  private stream: StreamClient;
  private chat: BroadcasterChat;
  private options: BroadcasterOptions;
  private isRunning = false;

  constructor(options: BroadcasterOptions) {
    this.options = options;

    // Initialize PTY
    this.pty = new PtyCapture();

    // Initialize chat
    this.chat = new BroadcasterChat({
      enabled: options.showChat,
    });

    // Get WebSocket URL
    const { ws: wsUrl } = parseServerUrl(options.serverUrl);

    // Initialize stream client
    const streamOptions: StreamClientOptions = {
      serverUrl: `${wsUrl}/ws`,
      token: options.token,
      username: options.username,
      title: options.title,
      isPrivate: options.isPrivate,
      password: options.password,
      maxViewers: options.maxViewers,
      terminalSize: this.pty.getSize(),
    };

    this.stream = new StreamClient(streamOptions);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // PTY events
    this.pty.on('data', (data: string) => {
      // Write to local terminal
      process.stdout.write(data);
      // Send to stream
      this.stream.sendTerminalData(data);
    });

    this.pty.on('resize', (size) => {
      this.stream.sendTerminalResize(size);
    });

    this.pty.on('exit', (code) => {
      console.log(`\nShell exited with code ${code}`);
      this.stop();
    });

    // Stream events
    this.stream.on('connected', () => {
      // Already handled by streamCreated
    });

    this.stream.on('streamCreated', (streamId, roomId) => {
      console.clear();
      console.log(LOGO);
      console.log(STREAM_STARTED(roomId, this.options.title));
      console.log(WELCOME_STREAMER);
      console.log('\n\x1b[90m─────────────────────────────────────────────────────────────────────\x1b[0m\n');
    });

    this.stream.on('chat', (message) => {
      this.chat.handleChatMessage(message);
    });

    this.stream.on('viewerJoin', (username, count) => {
      this.chat.handleViewerJoin(username, count);
    });

    this.stream.on('viewerLeave', (username, count) => {
      this.chat.handleViewerLeave(username, count);
    });

    this.stream.on('modAction', (action) => {
      this.chat.handleModAction(action);
    });

    this.stream.on('disconnected', () => {
      if (this.isRunning) {
        console.log('\n\x1b[33mDisconnected from server. Attempting to reconnect...\x1b[0m');
      }
    });

    this.stream.on('error', (error) => {
      console.error(`\n\x1b[31mStream error: ${error.message}\x1b[0m`);
    });

    // Chat overlay handler
    if (this.options.showChat) {
      this.chat.setMessageHandler((formatted) => {
        // Save cursor, move to top, print message, restore cursor
        process.stdout.write(`\x1b7\x1b[1;1H\x1b[2K${formatted}\x1b8`);
      });
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;

    // Connect to server first
    console.log(`Connecting to ${this.options.serverUrl}...`);
    this.stream.connect();

    // Try to start PTY
    try {
      this.pty.start();
    } catch (err: any) {
      console.error(`\n\x1b[31mError: ${err.message}\x1b[0m\n`);
      this.stream.close();
      process.exit(1);
    }

    // Put terminal in raw mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    // Forward input to PTY
    process.stdin.on('data', (data) => {
      this.pty.write(data.toString());
    });
  }

  stop(): void {
    this.isRunning = false;

    // Restore terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    this.pty.kill();
    this.stream.close();

    console.log(GOODBYE);
    process.exit(0);
  }

  sendChat(message: string): void {
    this.stream.sendChat(message);
  }

  getViewerCount(): number {
    return this.chat.getViewerCount();
  }

  getRoomId(): string | null {
    return this.stream.getRoomId();
  }
}

export { PtyCapture } from './pty';
export { StreamClient } from './stream';
export { BroadcasterChat } from './chat';
