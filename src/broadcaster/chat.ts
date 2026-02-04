import { ChatMessage, ActionMessage, ModActionMessage } from '../shared/protocol.js';

export interface ChatOverlayOptions {
  enabled: boolean;
  maxMessages: number;
  position: 'top' | 'bottom';
}

export class BroadcasterChat {
  private messages: Array<ChatMessage | ActionMessage> = [];
  private viewerCount = 0;
  private options: ChatOverlayOptions;
  private onMessage?: (formatted: string) => void;

  constructor(options: Partial<ChatOverlayOptions> = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      maxMessages: options.maxMessages ?? 5,
      position: options.position ?? 'top',
    };
  }

  setMessageHandler(handler: (formatted: string) => void): void {
    this.onMessage = handler;
  }

  handleChatMessage(message: ChatMessage | ActionMessage): void {
    this.messages.push(message);
    if (this.messages.length > this.options.maxMessages) {
      this.messages.shift();
    }

    if (this.options.enabled && this.onMessage) {
      this.onMessage(this.formatMessage(message));
    }
  }

  handleViewerJoin(username: string, count: number): void {
    this.viewerCount = count;
    if (this.options.enabled && this.onMessage) {
      this.onMessage(`\x1b[32m+ ${username} joined (${count} viewers)\x1b[0m`);
    }
  }

  handleViewerLeave(username: string, count: number): void {
    this.viewerCount = count;
    if (this.options.enabled && this.onMessage) {
      this.onMessage(`\x1b[31m- ${username} left (${count} viewers)\x1b[0m`);
    }
  }

  handleModAction(action: ModActionMessage): void {
    if (this.options.enabled && this.onMessage) {
      this.onMessage(this.formatModAction(action));
    }
  }

  private formatMessage(message: ChatMessage | ActionMessage): string {
    const roleColor = this.getRoleColor(message.role);

    if (message.type === 'action') {
      return `${roleColor}* ${message.username} ${message.content}\x1b[0m`;
    }

    return `${roleColor}[${message.username}]\x1b[0m: ${message.content}`;
  }

  private formatModAction(action: ModActionMessage): string {
    switch (action.action) {
      case 'ban':
        return `\x1b[33m[MOD] ${action.moderator} banned ${action.targetUsername}${action.duration ? ` for ${action.duration}s` : ''}\x1b[0m`;
      case 'unban':
        return `\x1b[33m[MOD] ${action.moderator} unbanned ${action.targetUsername}\x1b[0m`;
      case 'mute':
        return `\x1b[33m[MOD] ${action.moderator} muted ${action.targetUsername}${action.duration ? ` for ${action.duration}s` : ''}\x1b[0m`;
      case 'unmute':
        return `\x1b[33m[MOD] ${action.moderator} unmuted ${action.targetUsername}\x1b[0m`;
      case 'mod':
        return `\x1b[33m[MOD] ${action.moderator} gave mod to ${action.targetUsername}\x1b[0m`;
      case 'unmod':
        return `\x1b[33m[MOD] ${action.moderator} removed mod from ${action.targetUsername}\x1b[0m`;
      case 'slow':
        return `\x1b[33m[MOD] ${action.moderator} set slow mode to ${action.duration || 0}s\x1b[0m`;
      case 'clear':
        return `\x1b[33m[MOD] ${action.moderator} cleared chat\x1b[0m`;
      default:
        return '';
    }
  }

  private getRoleColor(role: string): string {
    switch (role) {
      case 'broadcaster':
        return '\x1b[35m'; // Magenta
      case 'mod':
        return '\x1b[32m'; // Green
      default:
        return '\x1b[36m'; // Cyan
    }
  }

  getViewerCount(): number {
    return this.viewerCount;
  }

  getRecentMessages(): Array<ChatMessage | ActionMessage> {
    return [...this.messages];
  }

  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }
}
