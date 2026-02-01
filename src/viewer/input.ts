import * as blessed from 'blessed';

export interface InputHandlerOptions {
  onSubmit: (text: string) => void;
  onEscape?: () => void;
}

export class InputHandler {
  private inputBox: blessed.Widgets.TextboxElement;
  private screen: blessed.Widgets.Screen;
  private options: InputHandlerOptions;

  constructor(screen: blessed.Widgets.Screen, options: InputHandlerOptions) {
    this.screen = screen;
    this.options = options;

    this.inputBox = blessed.textbox({
      parent: screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      label: ' Message ',
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'cyan',
        },
        focus: {
          border: {
            fg: 'green',
          },
        },
      },
      inputOnFocus: true,
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    this.inputBox.on('submit', (value) => {
      if (value && value.trim()) {
        this.options.onSubmit(value.trim());
      }
      this.inputBox.clearValue();
      this.inputBox.focus();
      this.screen.render();
    });

    this.inputBox.on('cancel', () => {
      this.inputBox.clearValue();
      if (this.options.onEscape) {
        this.options.onEscape();
      }
      this.screen.render();
    });

    // Handle special keys
    this.inputBox.key(['escape'], () => {
      this.inputBox.clearValue();
      if (this.options.onEscape) {
        this.options.onEscape();
      }
      this.screen.render();
    });
  }

  focus(): void {
    this.inputBox.focus();
    this.screen.render();
  }

  blur(): void {
    this.inputBox.cancel();
    this.screen.render();
  }

  getValue(): string {
    return this.inputBox.getValue();
  }

  setValue(text: string): void {
    this.inputBox.setValue(text);
    this.screen.render();
  }

  clear(): void {
    this.inputBox.clearValue();
    this.screen.render();
  }

  getElement(): blessed.Widgets.TextboxElement {
    return this.inputBox;
  }

  setPlaceholder(text: string): void {
    this.inputBox.setLabel(` ${text} `);
    this.screen.render();
  }

  disable(): void {
    this.inputBox.style.border.fg = 'gray';
    this.screen.render();
  }

  enable(): void {
    this.inputBox.style.border.fg = 'cyan';
    this.screen.render();
  }
}
