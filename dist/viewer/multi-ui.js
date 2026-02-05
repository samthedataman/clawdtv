import blessed from 'blessed';
import { WELCOME_MULTI_VIEWER } from '../shared/ascii.js';
export class MultiViewerUI {
    screen;
    options;
    tabs = [];
    activeTabIndex = 0;
    // UI Elements
    tabBar;
    terminalBox;
    chatBox = null;
    chatMessages = null;
    inputBox = null;
    statusBar;
    constructor(options) {
        this.options = options;
        // Initialize tabs
        for (let i = 0; i < options.roomIds.length; i++) {
            this.tabs.push({
                index: i,
                roomId: options.roomIds[i],
                title: `Stream ${i + 1}`,
                broadcaster: 'Connecting...',
                viewerCount: 0,
                connected: false,
                terminalContent: '',
                chatMessages: [],
            });
        }
        // Create screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'clawdtv.com - Multi Stream',
            fullUnicode: true,
        });
        // Create UI elements
        this.createTabBar();
        this.createTerminalBox();
        if (options.showChat) {
            this.createChatBox();
            this.createInputBox();
        }
        this.createStatusBar();
        this.setupKeyBindings();
        this.updateTabBar();
        this.screen.render();
    }
    createTabBar() {
        this.tabBar = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '100%',
            height: 1,
            style: {
                bg: 'blue',
                fg: 'white',
            },
        });
    }
    createTerminalBox() {
        const chatWidth = this.options.showChat ? '30%' : '0%';
        const termWidth = this.options.showChat ? '70%' : '100%';
        this.terminalBox = blessed.box({
            parent: this.screen,
            label: ' Stream ',
            top: 1,
            left: 0,
            width: termWidth,
            height: this.options.showChat ? '100%-5' : '100%-3',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                label: { fg: 'white', bold: true },
            },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: '█',
                style: { bg: 'cyan' },
            },
            tags: false,
        });
    }
    createChatBox() {
        this.chatBox = blessed.box({
            parent: this.screen,
            label: ' Chat ',
            top: 1,
            right: 0,
            width: '30%',
            height: '100%-5',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                label: { fg: 'white', bold: true },
            },
        });
        // Viewer count
        blessed.text({
            parent: this.chatBox,
            top: 0,
            right: 1,
            content: '👥 0',
            style: { fg: 'yellow' },
            tags: true,
        });
        this.chatMessages = blessed.box({
            parent: this.chatBox,
            top: 1,
            left: 0,
            right: 0,
            bottom: 0,
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: '█',
                style: { bg: 'cyan' },
            },
            tags: true,
        });
    }
    createInputBox() {
        this.inputBox = blessed.textbox({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 3,
            label: ' Message (Tab to cycle streams) ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                focus: { border: { fg: 'green' } },
            },
            inputOnFocus: true,
        });
        this.inputBox.on('submit', (value) => {
            if (value && value.trim()) {
                this.options.onSendMessage(this.activeTabIndex, value.trim());
            }
            this.inputBox.clearValue();
            this.inputBox.focus();
            this.screen.render();
        });
        this.inputBox.focus();
    }
    createStatusBar() {
        const bottom = this.options.showChat ? 3 : 0;
        this.statusBar = blessed.box({
            parent: this.screen,
            bottom,
            left: 0,
            width: '100%',
            height: 1,
            content: ' 1-9,0: Switch streams | Tab: Next stream | Ctrl+C: Quit ',
            style: { fg: 'black', bg: 'cyan' },
        });
    }
    setupKeyBindings() {
        // Quit
        this.screen.key(['C-c'], () => {
            this.options.onQuit();
        });
        // Number keys to switch tabs (1-9 for tabs 0-8, 0 for tab 9)
        for (let i = 1; i <= 9; i++) {
            this.screen.key([String(i)], () => {
                if (i - 1 < this.tabs.length) {
                    this.switchToTab(i - 1);
                }
            });
        }
        this.screen.key(['0'], () => {
            if (this.tabs.length >= 10) {
                this.switchToTab(9);
            }
        });
        // Tab to cycle through streams
        this.screen.key(['tab'], () => {
            const next = (this.activeTabIndex + 1) % this.tabs.length;
            this.switchToTab(next);
        });
        // Shift+Tab to cycle backwards
        this.screen.key(['S-tab'], () => {
            const prev = (this.activeTabIndex - 1 + this.tabs.length) % this.tabs.length;
            this.switchToTab(prev);
        });
        // Page up/down for scrolling
        this.screen.key(['pageup'], () => {
            this.terminalBox.scroll(-5);
            this.screen.render();
        });
        this.screen.key(['pagedown'], () => {
            this.terminalBox.scroll(5);
            this.screen.render();
        });
    }
    switchToTab(index) {
        if (index < 0 || index >= this.tabs.length)
            return;
        this.activeTabIndex = index;
        this.updateTabBar();
        this.refreshTerminal();
        this.refreshChat();
        this.updateLabels();
        this.screen.render();
    }
    updateTabBar() {
        let content = '';
        for (let i = 0; i < this.tabs.length; i++) {
            const tab = this.tabs[i];
            const num = i < 9 ? i + 1 : 0;
            const status = tab.connected ? '●' : (tab.error ? '✗' : '○');
            const statusColor = tab.connected ? '{green-fg}' : (tab.error ? '{red-fg}' : '{yellow-fg}');
            if (i === this.activeTabIndex) {
                content += `{black-bg}{white-fg}{bold} [${num}] ${statusColor}${status}{/} ${tab.title.slice(0, 15)} {/}`;
            }
            else {
                content += ` [${num}] ${statusColor}${status}{/} ${tab.title.slice(0, 10)} `;
            }
        }
        this.tabBar.setContent(content);
    }
    updateLabels() {
        const tab = this.tabs[this.activeTabIndex];
        this.terminalBox.setLabel(` ${tab.title} by ${tab.broadcaster} `);
        if (this.chatBox) {
            this.chatBox.setLabel(` Chat (${tab.viewerCount} viewers) `);
        }
    }
    refreshTerminal() {
        const tab = this.tabs[this.activeTabIndex];
        this.terminalBox.setContent(tab.terminalContent);
        this.terminalBox.setScrollPerc(100);
    }
    refreshChat() {
        if (!this.chatMessages)
            return;
        const tab = this.tabs[this.activeTabIndex];
        const content = tab.chatMessages.map(m => m.formatted).join('\n');
        this.chatMessages.setContent(content);
        this.chatMessages.setScrollPerc(100);
    }
    // Public methods for updating stream data
    setStreamInfo(index, title, broadcaster, viewerCount) {
        if (index >= this.tabs.length)
            return;
        const tab = this.tabs[index];
        tab.title = title;
        tab.broadcaster = broadcaster;
        tab.viewerCount = viewerCount;
        tab.connected = true;
        tab.error = undefined;
        this.updateTabBar();
        if (index === this.activeTabIndex) {
            this.updateLabels();
        }
        this.screen.render();
    }
    appendTerminalData(index, data) {
        if (index >= this.tabs.length)
            return;
        const tab = this.tabs[index];
        tab.terminalContent += data;
        // Keep content reasonable
        if (tab.terminalContent.length > 500000) {
            tab.terminalContent = tab.terminalContent.slice(-250000);
        }
        if (index === this.activeTabIndex) {
            this.terminalBox.setContent(tab.terminalContent);
            this.terminalBox.setScrollPerc(100);
            this.screen.render();
        }
    }
    addChatMessage(index, message) {
        if (index >= this.tabs.length)
            return;
        const tab = this.tabs[index];
        const formatted = this.formatMessage(message);
        tab.chatMessages.push({ formatted, raw: message });
        if (tab.chatMessages.length > 200) {
            tab.chatMessages.shift();
        }
        if (index === this.activeTabIndex && this.chatMessages) {
            const content = tab.chatMessages.map(m => m.formatted).join('\n');
            this.chatMessages.setContent(content);
            this.chatMessages.setScrollPerc(100);
            this.screen.render();
        }
    }
    setViewerCount(index, count) {
        if (index >= this.tabs.length)
            return;
        this.tabs[index].viewerCount = count;
        if (index === this.activeTabIndex) {
            this.updateLabels();
            this.screen.render();
        }
    }
    setConnected(index) {
        if (index >= this.tabs.length)
            return;
        const tab = this.tabs[index];
        tab.connected = true;
        tab.error = undefined;
        // Show welcome message on first connect
        if (tab.terminalContent === '') {
            tab.terminalContent = WELCOME_MULTI_VIEWER + '\n\x1b[90m─────────────────────────────────────────────────────────────────────\x1b[0m\n\n';
            if (index === this.activeTabIndex) {
                this.refreshTerminal();
            }
        }
        this.updateTabBar();
        this.screen.render();
    }
    setDisconnected(index) {
        if (index >= this.tabs.length)
            return;
        this.tabs[index].connected = false;
        this.updateTabBar();
        this.screen.render();
    }
    setError(index, error) {
        if (index >= this.tabs.length)
            return;
        const tab = this.tabs[index];
        tab.error = error;
        tab.connected = false;
        tab.terminalContent += `\n{red-fg}Error: ${error}{/red-fg}\n`;
        this.updateTabBar();
        if (index === this.activeTabIndex) {
            this.refreshTerminal();
        }
        this.screen.render();
    }
    setStreamEnded(index, reason) {
        if (index >= this.tabs.length)
            return;
        const tab = this.tabs[index];
        tab.connected = false;
        tab.terminalContent += `\n\n--- Stream ended: ${reason} ---\n`;
        this.updateTabBar();
        if (index === this.activeTabIndex) {
            this.refreshTerminal();
        }
        this.screen.render();
    }
    formatMessage(message) {
        switch (message.type) {
            case 'chat':
            case 'action': {
                const roleTag = this.getRoleTag(message.role);
                const username = this.escapeMarkup(message.username);
                const content = this.escapeMarkup(message.content);
                if (message.type === 'action') {
                    return `${roleTag}* ${username} ${content}{/}`;
                }
                return `${roleTag}[${username}]{/}: ${content}`;
            }
            case 'viewer_join':
                return `{green-fg}+ ${this.escapeMarkup(message.username)} joined{/green-fg}`;
            case 'viewer_leave':
                return `{red-fg}- ${this.escapeMarkup(message.username)} left{/red-fg}`;
            case 'system':
                return `{gray-fg}[System] ${this.escapeMarkup(message.content)}{/gray-fg}`;
            case 'mod_action':
                return `{yellow-fg}[MOD] ${message.moderator}: ${message.action}${message.targetUsername ? ' ' + message.targetUsername : ''}{/yellow-fg}`;
            default:
                return '';
        }
    }
    getRoleTag(role) {
        switch (role) {
            case 'broadcaster': return '{magenta-fg}{bold}';
            case 'mod': return '{green-fg}';
            default: return '{cyan-fg}';
        }
    }
    escapeMarkup(text) {
        return text.replace(/\{/g, '{{').replace(/\}/g, '}}');
    }
    destroy() {
        this.screen.destroy();
    }
    render() {
        this.screen.render();
    }
}
//# sourceMappingURL=multi-ui.js.map