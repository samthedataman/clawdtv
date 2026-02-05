/**
 * Terminal Formatter: Markdown-to-ANSI Parser
 *
 * Converts markdown-like syntax into rich ANSI escape codes for terminal display.
 * Supports streaming with state management for incomplete tokens across chunks.
 */
// ANSI escape code constants
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
// 256-color ANSI codes
const COLORS = {
    // Headers
    HEADER_1: 75, // Bright blue (#5FAFFF)
    HEADER_2: 117, // Light blue (#87D7FF)
    HEADER_3: 153, // Pale blue (#AFD7FF)
    // Text hierarchy
    TEXT_PRIMARY: 252, // Light gray (#D0D0D0)
    TEXT_SECONDARY: 248, // Medium gray (#A8A8A8)
    TEXT_DIM: 240, // Dark gray (#585858)
    // Semantic states
    SUCCESS: 120, // Bright green (#87FF87)
    WARNING: 221, // Yellow (#FFD75F)
    ERROR: 210, // Red (#FF8787)
    INFO: 117, // Blue (#87D7FF)
    // Code & quotes
    CODE_FG: 156, // Light green (#AFFF87)
    CODE_BG: 235, // Dark gray bg (#262626)
    QUOTE_FG: 248, // Medium gray
    QUOTE_BORDER: 244, // Gray border
    // Badges
    BADGE_BG: 235, // Dark gray bg
    BADGE_FG: [117, 153, 75], // Rotating blues
    // Dividers
    DIVIDER: 240, // Dark gray
    // List markers
    LIST_BULLET: 75, // Bright blue
    // Links
    LINK: 75, // Bright blue
};
// ANSI formatting helpers
const ansi = {
    reset: RESET,
    bold: `${ESC}1m`,
    dim: `${ESC}2m`,
    italic: `${ESC}3m`,
    underline: `${ESC}4m`,
    // 256-color foreground
    fg: (code) => `${ESC}38;5;${code}m`,
    // 256-color background
    bg: (code) => `${ESC}48;5;${code}m`,
    // Combined styles
    boldFg: (code) => `${ESC}1m${ESC}38;5;${code}m`,
    italicFg: (code) => `${ESC}3m${ESC}38;5;${code}m`,
    underlineFg: (code) => `${ESC}4m${ESC}38;5;${code}m`,
};
// Badge color detection
function getBadgeColor(content) {
    const upper = content.toUpperCase();
    if (upper.includes('ERROR') || upper.includes('FAIL'))
        return 196; // Red
    if (upper.includes('WARN') || upper.includes('CAUTION'))
        return 214; // Orange
    if (upper.includes('SUCCESS') || upper.includes('PASS') || upper.includes('OK'))
        return 34; // Green
    if (upper.includes('INFO') || upper.includes('NOTE'))
        return 33; // Blue
    return 135; // Purple (default accent)
}
const defaultOptions = {
    enabled: true,
    preserveExistingAnsi: true,
    semanticColors: true,
};
/**
 * Main TerminalFormatter class
 * Handles streaming markdown-to-ANSI conversion with state management
 */
export class TerminalFormatter {
    buffer = '';
    options;
    // Pre-compiled regex patterns (Fix 10: avoid recompilation per line)
    static RE_ANSI = /\x1b\[/;
    static RE_H3 = /^###\s+(.+)$/;
    static RE_H2 = /^##\s+(.+)$/;
    static RE_H1 = /^#\s+(.+)$/;
    static RE_BOLD = /\*\*([^*]+)\*\*/g;
    static RE_ITALIC_AST = /(?<!\*)\*([^*]+)\*(?!\*)/g;
    static RE_ITALIC_UND = /_([^_]+)_/g;
    static RE_INLINE_CODE = /`([^`]+)`/g;
    static RE_QUOTE = /^>\s+(.+)$/;
    static RE_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
    static RE_BADGE = /\[([^\]]{1,20})\](?!\()/g; // Fix 1: negative lookahead avoids links
    static RE_DIVIDER = /^[-*]{3,}$/;
    static RE_BULLET = /^(\s*)(•|-|\*)\s+(.+)$/;
    static RE_NUMBERED = /^(\s*)(\d+)\.\s+(.+)$/;
    static RE_EMOJI = /[\u{1F300}-\u{1F9FF}]/u;
    // Fix 4: Buffer size protection
    static MAX_BUFFER_SIZE = 4096;
    constructor(options = {}) {
        this.options = { ...defaultOptions, ...options };
    }
    /**
     * Format a chunk of terminal data
     * Handles incomplete markdown tokens across chunks
     */
    format(chunk) {
        if (!this.options.enabled) {
            return chunk;
        }
        // Combine with buffered incomplete data
        const data = this.buffer + chunk;
        // Fix 3: Handle both \r\n and \n line endings
        const lines = data.split(/\r?\n/);
        this.buffer = lines.pop() || '';
        // Fix 4: Protect against unbounded buffer growth
        let overflow = '';
        if (this.buffer.length > TerminalFormatter.MAX_BUFFER_SIZE) {
            overflow = this.formatLine(this.buffer) + '\n';
            this.buffer = '';
        }
        // Process complete lines
        const formatted = lines.map(line => this.formatLine(line)).join('\n');
        return (formatted ? formatted + '\n' : '') + overflow;
    }
    /**
     * Format a single line
     * Order matters: structural patterns first, then inline formatting
     */
    formatLine(line) {
        // Skip if line already contains ANSI codes (preserve existing)
        if (this.options.preserveExistingAnsi && TerminalFormatter.RE_ANSI.test(line)) {
            return line;
        }
        let result = line;
        // 1. Structural/line-level patterns first (headers, quotes, dividers, lists)
        result = this.formatHeaders(result);
        result = this.formatQuotes(result);
        result = this.formatDividers(result);
        // Fix 2: Process bullets BEFORE bold/italic to prevent * conflicts
        result = this.formatBullets(result);
        result = this.formatNumberedLists(result);
        // 2. Then inline formatting (bold, italic, code, links, badges)
        result = this.formatBold(result);
        result = this.formatItalic(result);
        result = this.formatInlineCode(result);
        // Fix 1: Process links BEFORE badges to prevent [text](url) from matching as badge
        result = this.formatLinks(result);
        result = this.formatBadges(result);
        return result;
    }
    /**
     * Format headers: ### first (most specific), then ##, then #
     */
    formatHeaders(line) {
        // H3: ### Small header (check first - most specific)
        if (TerminalFormatter.RE_H3.test(line)) {
            return line.replace(TerminalFormatter.RE_H3, (_, text) => {
                return `${ansi.fg(COLORS.HEADER_3)}• ${text}${ansi.reset}`;
            });
        }
        // H2: ## Subheader
        if (TerminalFormatter.RE_H2.test(line)) {
            return line.replace(TerminalFormatter.RE_H2, (_, text) => {
                // Fix 5: Reset before header to clear any lingering ANSI state
                return `${ansi.reset}\n${ansi.boldFg(COLORS.HEADER_2)}▸ ${text}${ansi.reset}`;
            });
        }
        // H1: # Header
        if (TerminalFormatter.RE_H1.test(line)) {
            return line.replace(TerminalFormatter.RE_H1, (_, text) => {
                return `${ansi.reset}\n${ansi.boldFg(COLORS.HEADER_1)}${text}${ansi.reset}`;
            });
        }
        return line;
    }
    formatBold(line) {
        TerminalFormatter.RE_BOLD.lastIndex = 0;
        return line.replace(TerminalFormatter.RE_BOLD, (_, text) => {
            return `${ansi.bold}${text}${ansi.reset}`;
        });
    }
    formatItalic(line) {
        TerminalFormatter.RE_ITALIC_AST.lastIndex = 0;
        line = line.replace(TerminalFormatter.RE_ITALIC_AST, (_, text) => {
            return `${ansi.italic}${text}${ansi.reset}`;
        });
        TerminalFormatter.RE_ITALIC_UND.lastIndex = 0;
        line = line.replace(TerminalFormatter.RE_ITALIC_UND, (_, text) => {
            return `${ansi.italic}${text}${ansi.reset}`;
        });
        return line;
    }
    formatInlineCode(line) {
        TerminalFormatter.RE_INLINE_CODE.lastIndex = 0;
        return line.replace(TerminalFormatter.RE_INLINE_CODE, (_, code) => {
            return `${ansi.bg(COLORS.CODE_BG)}${ansi.fg(COLORS.CODE_FG)} ${code} ${ansi.reset}`;
        });
    }
    formatQuotes(line) {
        if (TerminalFormatter.RE_QUOTE.test(line)) {
            return line.replace(TerminalFormatter.RE_QUOTE, (_, text) => {
                return `${ansi.fg(COLORS.QUOTE_BORDER)}│${ansi.reset} ${ansi.italicFg(COLORS.QUOTE_FG)}${text}${ansi.reset}`;
            });
        }
        return line;
    }
    /**
     * Format links: [text](url) - MUST run before formatBadges
     */
    formatLinks(line) {
        TerminalFormatter.RE_LINK.lastIndex = 0;
        return line.replace(TerminalFormatter.RE_LINK, (_, text, url) => {
            return `${ansi.underlineFg(COLORS.LINK)}${text}${ansi.reset} ${ansi.fg(COLORS.TEXT_DIM)}(${url})${ansi.reset}`;
        });
    }
    /**
     * Format badges: [TAG] or [emoji] - negative lookahead prevents matching links
     */
    formatBadges(line) {
        TerminalFormatter.RE_BADGE.lastIndex = 0;
        return line.replace(TerminalFormatter.RE_BADGE, (_, content) => {
            if (TerminalFormatter.RE_EMOJI.test(content)) {
                return `${ansi.bg(COLORS.BADGE_BG)}${content}${ansi.reset}`;
            }
            const color = getBadgeColor(content);
            return `${ansi.bg(color)}${ansi.fg(255)} ${content} ${ansi.reset}`;
        });
    }
    formatDividers(line) {
        if (TerminalFormatter.RE_DIVIDER.test(line)) {
            return `${ansi.fg(COLORS.DIVIDER)}${'━'.repeat(60)}${ansi.reset}`;
        }
        return line;
    }
    /**
     * Format bullet lists: • Item or - Item or * Item
     * Runs BEFORE italic to prevent * conflicts
     */
    formatBullets(line) {
        if (TerminalFormatter.RE_BULLET.test(line)) {
            return line.replace(TerminalFormatter.RE_BULLET, (_, indent, _marker, text) => {
                return `${indent}${ansi.fg(COLORS.LIST_BULLET)}•${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${text}${ansi.reset}`;
            });
        }
        return line;
    }
    formatNumberedLists(line) {
        if (TerminalFormatter.RE_NUMBERED.test(line)) {
            return line.replace(TerminalFormatter.RE_NUMBERED, (_, indent, num, text) => {
                return `${indent}${ansi.fg(COLORS.HEADER_2)}${num}.${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${text}${ansi.reset}`;
            });
        }
        return line;
    }
    reset() {
        this.buffer = '';
    }
    flush() {
        const remaining = this.buffer;
        this.buffer = '';
        return remaining ? this.formatLine(remaining) : '';
    }
}
/**
 * Quick utility functions for manual formatting
 */
export const fmt = {
    /**
     * Format as H1 header
     */
    header1(text) {
        return `\n\n${ansi.boldFg(COLORS.HEADER_1)}${text}${ansi.reset}\n${ansi.fg(COLORS.TEXT_DIM)}${'─'.repeat(text.length)}${ansi.reset}\n`;
    },
    /**
     * Format as H2 header
     */
    header2(text) {
        return `\n${ansi.boldFg(COLORS.HEADER_2)}▸ ${text}${ansi.reset}\n`;
    },
    /**
     * Format as H3 header
     */
    header3(text) {
        return `${ansi.fg(COLORS.HEADER_3)}• ${text}${ansi.reset}\n`;
    },
    /**
     * Format as paragraph with text wrapping
     */
    paragraph(text, width = 72) {
        const wrapped = wrapText(text, width);
        return `${ansi.fg(COLORS.TEXT_PRIMARY)}${wrapped}${ansi.reset}\n`;
    },
    /**
     * Format as quote block
     */
    quote(text) {
        const lines = text.split('\n');
        return lines
            .map(line => `${ansi.fg(COLORS.QUOTE_BORDER)}│${ansi.reset} ${ansi.italicFg(COLORS.QUOTE_FG)}${line}${ansi.reset}`)
            .join('\n') + '\n';
    },
    /**
     * Format as inline code
     */
    code(text) {
        return `${ansi.bg(COLORS.CODE_BG)}${ansi.fg(COLORS.CODE_FG)} ${text} ${ansi.reset}`;
    },
    /**
     * Format as code block
     */
    codeBlock(code) {
        const lines = code.split('\n');
        const maxLen = Math.max(...lines.map(l => l.length)) + 4;
        const top = `${ansi.fg(COLORS.TEXT_DIM)}┌${'─'.repeat(maxLen)}┐${ansi.reset}`;
        const bottom = `${ansi.fg(COLORS.TEXT_DIM)}└${'─'.repeat(maxLen)}┘${ansi.reset}`;
        const content = lines.map(line => `${ansi.fg(COLORS.TEXT_DIM)}│${ansi.reset} ${ansi.fg(COLORS.CODE_FG)}${line.padEnd(maxLen - 2)}${ansi.reset} ${ansi.fg(COLORS.TEXT_DIM)}│${ansi.reset}`).join('\n');
        return `\n${top}\n${content}\n${bottom}\n`;
    },
    /**
     * Format as badge
     */
    badge(text, colorCode) {
        const color = colorCode || getBadgeColor(text);
        return `${ansi.bg(color)}${ansi.fg(255)} ${text} ${ansi.reset}`;
    },
    /**
     * Format multiple tags
     */
    tags(tags) {
        return tags
            .map((tag, i) => {
            const colorCode = COLORS.BADGE_FG[i % COLORS.BADGE_FG.length];
            return `${ansi.bg(COLORS.BADGE_BG)}${ansi.fg(colorCode)} #${tag} ${ansi.reset}`;
        })
            .join(' ') + '\n';
    },
    /**
     * Format as horizontal divider
     */
    divider(width = 80) {
        return `\n${ansi.fg(COLORS.DIVIDER)}${'━'.repeat(width)}${ansi.reset}\n`;
    },
    /**
     * Format as metadata/secondary text
     */
    metadata(text) {
        return `${ansi.dim}${ansi.fg(COLORS.TEXT_DIM)}${text}${ansi.reset}\n`;
    },
    /**
     * Format as bullet list
     */
    bulletList(items) {
        return items
            .map(item => `  ${ansi.fg(COLORS.LIST_BULLET)}•${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${item}${ansi.reset}`)
            .join('\n') + '\n';
    },
    /**
     * Format as numbered list
     */
    numberedList(items) {
        return items
            .map((item, i) => `  ${ansi.fg(COLORS.HEADER_2)}${i + 1}.${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${item}${ansi.reset}`)
            .join('\n') + '\n';
    },
};
/**
 * Wrap text to specified width
 */
function wrapText(text, width) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        if ((currentLine + word).length > width) {
            if (currentLine)
                lines.push(currentLine.trim());
            currentLine = word + ' ';
        }
        else {
            currentLine += word + ' ';
        }
    }
    if (currentLine)
        lines.push(currentLine.trim());
    return lines.join('\n');
}
// Export for convenience
export { COLORS, ansi };
//# sourceMappingURL=terminal-formatter.js.map