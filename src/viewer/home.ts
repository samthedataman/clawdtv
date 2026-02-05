import blessed from 'blessed';

export interface StreamInfo {
  id: string;
  title: string;
  broadcaster: string;
  viewerCount: number;
  startedAt: number;
  hasPassword: boolean;
}

export interface HomeScreenOptions {
  serverUrl: string;
  token: string | null;
  onWatch: (roomId: string) => void;
  onStream: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onRefresh: () => Promise<StreamInfo[]>;
  onQuit: () => void;
}

export class HomeScreen {
  private screen: blessed.Widgets.Screen;
  private options: HomeScreenOptions;
  private streams: StreamInfo[] = [];
  private selectedIndex: number = 0;

  // UI Elements
  private header!: blessed.Widgets.BoxElement;
  private streamList!: blessed.Widgets.ListElement;
  private streamDetails!: blessed.Widgets.BoxElement;
  private statusBar!: blessed.Widgets.BoxElement;
  private logo!: blessed.Widgets.BoxElement;

  constructor(options: HomeScreenOptions) {
    this.options = options;

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'clawdtv.com',
      fullUnicode: true,
    });

    this.createUI();
    this.setupKeyBindings();
    this.refresh();
  }

  private createUI(): void {
    // ASCII Logo
    this.logo = blessed.box({
      parent: this.screen,
      top: 0,
      left: 'center',
      width: 60,
      height: 8,
      content: `
{cyan-fg}{bold}
     ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗   ████████╗██╗   ██╗
    ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝   ╚══██╔══╝██║   ██║
    ██║     ██║     ███████║██║   ██║██║  ██║█████╗        ██║   ██║   ██║
    ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝        ██║   ╚██╗ ██╔╝
    ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗██╗   ██║    ╚████╔╝
     ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝     ╚═══╝
{/bold}{/cyan-fg}
{center}{gray-fg}Terminal Streaming for Claude Code{/gray-fg}{/center}`,
      tags: true,
      style: {
        fg: 'white',
      },
    });

    // Header with stats
    this.header = blessed.box({
      parent: this.screen,
      top: 8,
      left: 0,
      width: '100%',
      height: 3,
      content: '',
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue',
      },
      padding: {
        left: 2,
        right: 2,
      },
    });

    // Stream list (left side)
    this.streamList = blessed.list({
      parent: this.screen,
      label: ' {bold}Live Streams{/bold} ',
      top: 11,
      left: 0,
      width: '60%',
      height: '100%-15',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        selected: {
          bg: 'cyan',
          fg: 'black',
          bold: true,
        },
        item: {
          fg: 'white',
        },
      },
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollbar: {
        ch: '█',
        style: { bg: 'cyan' },
      },
    });

    // Stream details (right side)
    this.streamDetails = blessed.box({
      parent: this.screen,
      label: ' {bold}Stream Info{/bold} ',
      top: 11,
      right: 0,
      width: '40%',
      height: '100%-15',
      border: { type: 'line' },
      style: {
        border: { fg: 'magenta' },
        label: { fg: 'white' },
      },
      tags: true,
      padding: {
        left: 1,
        right: 1,
      },
    });

    // Status bar
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      style: {
        border: { fg: 'gray' },
      },
      tags: true,
      padding: {
        left: 1,
      },
    });

    this.updateStatusBar();
  }

  private setupKeyBindings(): void {
    // Quit
    this.screen.key(['q', 'C-c'], () => {
      this.options.onQuit();
    });

    // Refresh
    this.screen.key(['r'], () => {
      this.refresh();
    });

    // Start streaming
    this.screen.key(['s'], () => {
      this.options.onStream();
    });

    // Watch selected stream
    this.screen.key(['enter', 'w'], () => {
      if (this.streams.length > 0 && this.selectedIndex < this.streams.length) {
        const stream = this.streams[this.selectedIndex];
        if (stream.hasPassword) {
          this.showMessage('This stream requires a password. Use: claude-tv watch ' + stream.id + ' -p <password>');
        } else {
          this.options.onWatch(stream.id);
        }
      }
    });

    // Navigate list
    this.streamList.on('select item', (item, index) => {
      this.selectedIndex = index;
      this.updateStreamDetails();
    });

    this.screen.key(['up', 'k'], () => {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        this.streamList.select(this.selectedIndex);
        this.updateStreamDetails();
        this.screen.render();
      }
    });

    this.screen.key(['down', 'j'], () => {
      if (this.selectedIndex < this.streams.length - 1) {
        this.selectedIndex++;
        this.streamList.select(this.selectedIndex);
        this.updateStreamDetails();
        this.screen.render();
      }
    });
  }

  private updateStatusBar(): void {
    this.statusBar.setContent(
      `{cyan-fg}Enter{/cyan-fg}: Watch  |  {cyan-fg}S{/cyan-fg}: Start Streaming  |  {cyan-fg}R{/cyan-fg}: Refresh  |  {cyan-fg}Q{/cyan-fg}: Quit`
    );
  }

  private updateHeader(): void {
    const totalViewers = this.streams.reduce((sum, s) => sum + s.viewerCount, 0);
    const liveCount = this.streams.length;

    this.header.setContent(
      `{bold}🔴 ${liveCount} LIVE{/bold}  |  👥 ${totalViewers} viewers  |  ` +
      `{gray-fg}Press R to refresh{/gray-fg}`
    );
  }

  private updateStreamList(): void {
    if (this.streams.length === 0) {
      this.streamList.setItems([
        '',
        '  {gray-fg}No streams live right now{/gray-fg}',
        '',
        '  {cyan-fg}Be the first! Press S to start streaming{/cyan-fg}',
      ]);
      return;
    }

    // Sort by viewer count (descending)
    const sorted = [...this.streams].sort((a, b) => b.viewerCount - a.viewerCount);
    this.streams = sorted;

    const items = sorted.map((stream, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
      const viewers = String(stream.viewerCount).padStart(4);
      const lock = stream.hasPassword ? '🔒' : '  ';
      const title = stream.title.length > 25 ? stream.title.slice(0, 22) + '...' : stream.title.padEnd(25);
      const broadcaster = stream.broadcaster.length > 12 ? stream.broadcaster.slice(0, 9) + '...' : stream.broadcaster;

      return `${medal} {bold}${title}{/bold} {gray-fg}by{/gray-fg} {cyan-fg}${broadcaster}{/cyan-fg}  {yellow-fg}👥 ${viewers}{/yellow-fg} ${lock}`;
    });

    this.streamList.setItems(items);
  }

  private updateStreamDetails(): void {
    if (this.streams.length === 0 || this.selectedIndex >= this.streams.length) {
      this.streamDetails.setContent(
        '\n{gray-fg}Select a stream to see details{/gray-fg}'
      );
      return;
    }

    const stream = this.streams[this.selectedIndex];
    const uptime = this.formatUptime(Date.now() - stream.startedAt);
    const rank = this.selectedIndex + 1;

    this.streamDetails.setContent(`
{bold}{cyan-fg}${stream.title}{/cyan-fg}{/bold}

{gray-fg}Broadcaster:{/gray-fg}  {white-fg}${stream.broadcaster}{/white-fg}
{gray-fg}Viewers:{/gray-fg}      {yellow-fg}${stream.viewerCount}{/yellow-fg}
{gray-fg}Uptime:{/gray-fg}       ${uptime}
{gray-fg}Rank:{/gray-fg}         #${rank}
${stream.hasPassword ? '{red-fg}🔒 Password Protected{/red-fg}' : '{green-fg}🔓 Open{/green-fg}'}

{gray-fg}Room ID:{/gray-fg}
{white-fg}${stream.id}{/white-fg}



{center}{cyan-fg}Press Enter to watch{/cyan-fg}{/center}
`);
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  async refresh(): Promise<void> {
    this.streamList.setItems(['{center}Loading...{/center}']);
    this.screen.render();

    try {
      this.streams = await this.options.onRefresh();
      this.selectedIndex = 0;
      this.updateHeader();
      this.updateStreamList();
      this.updateStreamDetails();
      if (this.streams.length > 0) {
        this.streamList.select(0);
      }
    } catch (error) {
      this.streamList.setItems([
        '',
        `  {red-fg}Error loading streams{/red-fg}`,
        `  {gray-fg}${error}{/gray-fg}`,
        '',
        '  {cyan-fg}Press R to retry{/cyan-fg}',
      ]);
    }

    this.screen.render();
  }

  private showMessage(msg: string): void {
    const msgBox = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      border: { type: 'line' },
      style: {
        border: { fg: 'yellow' },
      },
    });

    msgBox.display(msg, 3, () => {
      msgBox.destroy();
      this.screen.render();
    });
  }

  destroy(): void {
    this.screen.destroy();
  }

  render(): void {
    this.screen.render();
  }
}
