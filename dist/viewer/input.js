"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputHandler = void 0;
const blessed = __importStar(require("blessed"));
class InputHandler {
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
exports.InputHandler = InputHandler;
//# sourceMappingURL=input.js.map