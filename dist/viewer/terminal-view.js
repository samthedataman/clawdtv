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
exports.TerminalView = void 0;
const blessed = __importStar(require("blessed"));
class TerminalView {
    box;
    content = '';
    scrollback = [];
    maxScrollback = 1000;
    terminalSize = { cols: 80, rows: 24 };
    screen;
    constructor(screen) {
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
    appendData(data) {
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
    setTerminalSize(size) {
        this.terminalSize = size;
        this.box.setLabel(` Stream (${size.cols}x${size.rows}) `);
        this.screen.render();
    }
    clear() {
        this.content = '';
        this.scrollback = [];
        this.box.setContent('');
        this.screen.render();
    }
    scrollUp() {
        this.box.scroll(-1);
        this.screen.render();
    }
    scrollDown() {
        this.box.scroll(1);
        this.screen.render();
    }
    scrollToTop() {
        this.box.setScrollPerc(0);
        this.screen.render();
    }
    scrollToBottom() {
        this.box.setScrollPerc(100);
        this.screen.render();
    }
    focus() {
        this.box.focus();
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
    showDisconnected() {
        this.box.setLabel(' Stream (Disconnected) ');
        this.box.style.border.fg = 'red';
        this.screen.render();
    }
    showConnected() {
        this.box.setLabel(' Stream ');
        this.box.style.border.fg = 'cyan';
        this.screen.render();
    }
    showStreamEnded(reason) {
        this.appendData(`\n\n\x1b[33m--- Stream ended: ${reason} ---\x1b[0m\n`);
        this.box.setLabel(' Stream (Ended) ');
        this.box.style.border.fg = 'yellow';
        this.screen.render();
    }
}
exports.TerminalView = TerminalView;
//# sourceMappingURL=terminal-view.js.map