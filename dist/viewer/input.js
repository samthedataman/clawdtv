import * as blessed from 'blessed';
export class InputHandler {
    inputBox;
    screen;
    options;
    constructor(screen, options) {
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
    setupEvents() {
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
    focus() {
        this.inputBox.focus();
        this.screen.render();
    }
    blur() {
        this.inputBox.cancel();
        this.screen.render();
    }
    getValue() {
        return this.inputBox.getValue();
    }
    setValue(text) {
        this.inputBox.setValue(text);
        this.screen.render();
    }
    clear() {
        this.inputBox.clearValue();
        this.screen.render();
    }
    getElement() {
        return this.inputBox;
    }
    setPlaceholder(text) {
        this.inputBox.setLabel(` ${text} `);
        this.screen.render();
    }
    disable() {
        this.inputBox.style.border.fg = 'gray';
        this.screen.render();
    }
    enable() {
        this.inputBox.style.border.fg = 'cyan';
        this.screen.render();
    }
}
//# sourceMappingURL=input.js.map