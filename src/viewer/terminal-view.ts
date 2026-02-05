import blessed from 'blessed';
import { TerminalSize } from '../shared/types.js';

export class TerminalView {
  private box: blessed.Widgets.BoxElement;
  private content: string = '';
  private scrollback: string[] = [];
  private maxScrollback: number = 1000;
  private terminalSize: TerminalSize = { cols: 80, rows: 24 };
  private screen: blessed.Widgets.Screen;

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;

    this.box = blessed.box({
      parent: screen,
      label: ' Stream ',
      top: 0,
      left: 0,
      width: '70%',
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
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          bg: 'cyan',
        },
      },
      tags: false,
    });
  }

  appendData(data: string): void {
    // Accumulate content
    this.content += data;

    // Split into lines for scrollback
    const lines = this.content.split('\n');
    if (lines.length > this.maxScrollback) {
      this.scrollback = lines.slice(-this.maxScrollback);
      this.content = this.scrollback.join('\n');
    }

    // Update display
    this.box.setContent(this.content);
    this.box.setScrollPerc(100);
    this.screen.render();
  }

  setTerminalSize(size: TerminalSize): void {
    this.terminalSize = size;
    this.box.setLabel(` Stream (${size.cols}x${size.rows}) `);
    this.screen.render();
  }

  clear(): void {
    this.content = '';
    this.scrollback = [];
    this.box.setContent('');
    this.screen.render();
  }

  scrollUp(): void {
    this.box.scroll(-1);
    this.screen.render();
  }

  scrollDown(): void {
    this.box.scroll(1);
    this.screen.render();
  }

  scrollToTop(): void {
    this.box.setScrollPerc(0);
    this.screen.render();
  }

  scrollToBottom(): void {
    this.box.setScrollPerc(100);
    this.screen.render();
  }

  focus(): void {
    this.box.focus();
    this.box.style.border.fg = 'green';
    this.screen.render();
  }

  blur(): void {
    this.box.style.border.fg = 'cyan';
    this.screen.render();
  }

  getElement(): blessed.Widgets.BoxElement {
    return this.box;
  }

  showDisconnected(): void {
    this.box.setLabel(' Stream (Disconnected) ');
    this.box.style.border.fg = 'red';
    this.screen.render();
  }

  showConnected(): void {
    this.box.setLabel(' Stream ');
    this.box.style.border.fg = 'cyan';
    this.screen.render();
  }

  showStreamEnded(reason: string): void {
    this.appendData(`\n\n\x1b[33m--- Stream ended: ${reason} ---\x1b[0m\n`);
    this.box.setLabel(' Stream (Ended) ');
    this.box.style.border.fg = 'yellow';
    this.screen.render();
  }
}
