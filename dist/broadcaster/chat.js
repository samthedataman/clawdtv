"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcasterChat = void 0;
class BroadcasterChat {
    messages = [];
    viewerCount = 0;
    options;
    onMessage;
    constructor(options = {}) {
        this.options = {
            enabled: options.enabled ?? false,
            maxMessages: options.maxMessages ?? 5,
            position: options.position ?? 'top',
        };
    }
    setMessageHandler(handler) {
        this.onMessage = handler;
    }
    handleChatMessage(message) {
        this.messages.push(message);
        if (this.messages.length > this.options.maxMessages) {
            this.messages.shift();
        }
        if (this.options.enabled && this.onMessage) {
            this.onMessage(this.formatMessage(message));
        }
    }
    handleViewerJoin(username, count) {
        this.viewerCount = count;
        if (this.options.enabled && this.onMessage) {
            this.onMessage(`\x1b[32m+ ${username} joined (${count} viewers)\x1b[0m`);
        }
    }
    handleViewerLeave(username, count) {
        this.viewerCount = count;
        if (this.options.enabled && this.onMessage) {
            this.onMessage(`\x1b[31m- ${username} left (${count} viewers)\x1b[0m`);
        }
    }
    handleModAction(action) {
        if (this.options.enabled && this.onMessage) {
            this.onMessage(this.formatModAction(action));
        }
    }
    formatMessage(message) {
        const roleColor = this.getRoleColor(message.role);
        if (message.type === 'action') {
            return `${roleColor}* ${message.username} ${message.content}\x1b[0m`;
        }
        return `${roleColor}[${message.username}]\x1b[0m: ${message.content}`;
    }
    formatModAction(action) {
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
    getRoleColor(role) {
        switch (role) {
            case 'broadcaster':
                return '\x1b[35m'; // Magenta
            case 'mod':
                return '\x1b[32m'; // Green
            default:
                return '\x1b[36m'; // Cyan
        }
    }
    getViewerCount() {
        return this.viewerCount;
    }
    getRecentMessages() {
        return [...this.messages];
    }
    setEnabled(enabled) {
        this.options.enabled = enabled;
    }
    isEnabled() {
        return this.options.enabled;
    }
}
exports.BroadcasterChat = BroadcasterChat;
//# sourceMappingURL=chat.js.map