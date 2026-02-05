import blessed from 'blessed';
export class ChatView {
    box;
    messageList;
    viewerCountLabel;
    screen;
    messages = [];
    maxMessages = 200;
    viewerCount = 0;
    autoScroll = true;
    constructor(screen) {
        this.screen = screen;
        // Main chat container
        this.box = blessed.box({
            parent: screen,
            label: ' Chat ',
            top: 0,
            right: 0,
            width: '30%',
            height: '100%-3',
            border: {
                type: 'line',
            },
            style: {
                border: {
                    fg: 'cyan',
                },
                label: {
                    fg: 'white',
                    bold: true,
                },
            },
        });
        // Viewer count
        this.viewerCountLabel = blessed.text({
            parent: this.box,
            top: 0,
            right: 1,
            content: '👥 0',
            style: {
                fg: 'yellow',
            },
        });
        // Message list
        this.messageList = blessed.box({
            parent: this.box,
            top: 1,
            left: 0,
            right: 0,
            bottom: 0,
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: '█',
                style: {
                    bg: 'cyan',
                },
            },
            tags: true,
        });
    }
    addMessage(message) {
        const formatted = this.formatChatMessage(message);
        this.appendMessage(formatted);
    }
    addSystemMessage(message) {
        const formatted = `{gray-fg}[System] ${this.escapeMarkup(message.content)}{/gray-fg}`;
        this.appendMessage(formatted);
    }
    addModAction(action) {
        const formatted = this.formatModAction(action);
        this.appendMessage(formatted);
    }
    addViewerJoin(username) {
        const formatted = `{green-fg}+ ${this.escapeMarkup(username)} joined{/green-fg}`;
        this.appendMessage(formatted);
    }
    addViewerLeave(username) {
        const formatted = `{red-fg}- ${this.escapeMarkup(username)} left{/red-fg}`;
        this.appendMessage(formatted);
    }
    setViewerCount(count) {
        this.viewerCount = count;
        this.viewerCountLabel.setContent(`👥 ${count}`);
        this.screen.render();
    }
    formatChatMessage(message) {
        const roleTag = this.getRoleTag(message.role);
        const username = this.escapeMarkup(message.username);
        const content = this.escapeMarkup(message.content);
        if (message.type === 'action') {
            return `${roleTag}* ${username} ${content}{/}`;
        }
        return `${roleTag}[${username}]{/}: ${content}`;
    }
    formatModAction(action) {
        const target = action.targetUsername ? this.escapeMarkup(action.targetUsername) : '';
        const mod = this.escapeMarkup(action.moderator);
        switch (action.action) {
            case 'ban':
                return `{yellow-fg}[MOD] ${mod} banned ${target}${action.duration ? ` for ${action.duration}s` : ''}{/yellow-fg}`;
            case 'unban':
                return `{yellow-fg}[MOD] ${mod} unbanned ${target}{/yellow-fg}`;
            case 'mute':
                return `{yellow-fg}[MOD] ${mod} muted ${target}${action.duration ? ` for ${action.duration}s` : ''}{/yellow-fg}`;
            case 'unmute':
                return `{yellow-fg}[MOD] ${mod} unmuted ${target}{/yellow-fg}`;
            case 'mod':
                return `{yellow-fg}[MOD] ${mod} gave mod to ${target}{/yellow-fg}`;
            case 'unmod':
                return `{yellow-fg}[MOD] ${mod} removed mod from ${target}{/yellow-fg}`;
            case 'slow':
                return `{yellow-fg}[MOD] ${mod} set slow mode to ${action.duration || 0}s{/yellow-fg}`;
            case 'clear':
                this.clearMessages();
                return `{yellow-fg}[MOD] ${mod} cleared chat{/yellow-fg}`;
            default:
                return '';
        }
    }
    getRoleTag(role) {
        switch (role) {
            case 'broadcaster':
                return '{magenta-fg}{bold}';
            case 'mod':
                return '{green-fg}';
            default:
                return '{cyan-fg}';
        }
    }
    escapeMarkup(text) {
        return text.replace(/\{/g, '{{').replace(/\}/g, '}}');
    }
    appendMessage(formatted) {
        this.messages.push(formatted);
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
        this.messageList.setContent(this.messages.join('\n'));
        if (this.autoScroll) {
            this.messageList.setScrollPerc(100);
        }
        this.screen.render();
    }
    clearMessages() {
        this.messages = [];
        this.messageList.setContent('');
        this.screen.render();
    }
    loadMessages(messages) {
        messages.forEach((msg) => this.addMessage(msg));
    }
    scrollUp() {
        this.autoScroll = false;
        this.messageList.scroll(-1);
        this.screen.render();
    }
    scrollDown() {
        this.messageList.scroll(1);
        // Re-enable auto-scroll if at bottom
        const scrollPerc = this.messageList.getScrollPerc();
        if (scrollPerc >= 99) {
            this.autoScroll = true;
        }
        this.screen.render();
    }
    scrollToBottom() {
        this.autoScroll = true;
        this.messageList.setScrollPerc(100);
        this.screen.render();
    }
    focus() {
        this.messageList.focus();
        this.box.style.border.fg = 'green';
        this.screen.render();
    }
    blur() {
        this.box.style.border.fg = 'cyan';
        this.screen.render();
    }
    getElement() {
        return this.box;
    }
}
//# sourceMappingURL=chat-view.js.map