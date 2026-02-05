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
  HEADER_1: 75,        // Bright blue (#5FAFFF)
  HEADER_2: 117,       // Light blue (#87D7FF)
  HEADER_3: 153,       // Pale blue (#AFD7FF)

  // Text hierarchy
  TEXT_PRIMARY: 252,   // Light gray (#D0D0D0)
  TEXT_SECONDARY: 248, // Medium gray (#A8A8A8)
  TEXT_DIM: 240,       // Dark gray (#585858)

  // Semantic states
  SUCCESS: 120,        // Bright green (#87FF87)
  WARNING: 221,        // Yellow (#FFD75F)
  ERROR: 210,          // Red (#FF8787)
  INFO: 117,           // Blue (#87D7FF)

  // Code & quotes
  CODE_FG: 156,        // Light green (#AFFF87)
  CODE_BG: 235,        // Dark gray bg (#262626)
  QUOTE_FG: 248,       // Medium gray
  QUOTE_BORDER: 244,   // Gray border

  // Badges
  BADGE_BG: 235,       // Dark gray bg
  BADGE_FG: [117, 153, 75], // Rotating blues

  // Dividers
  DIVIDER: 240,        // Dark gray

  // List markers
  LIST_BULLET: 75,     // Bright blue

  // Links
  LINK: 75,            // Bright blue
} as const;

// ANSI formatting helpers
const ansi = {
  reset: RESET,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  underline: `${ESC}4m`,

  // 256-color foreground
  fg: (code: number) => `${ESC}38;5;${code}m`,

  // 256-color background
  bg: (code: number) => `${ESC}48;5;${code}m`,

  // Combined styles
  boldFg: (code: number) => `${ESC}1m${ESC}38;5;${code}m`,
  italicFg: (code: number) => `${ESC}3m${ESC}38;5;${code}m`,
  underlineFg: (code: number) => `${ESC}4m${ESC}38;5;${code}m`,
};

// Badge color detection
function getBadgeColor(content: string): number {
  const upper = content.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FAIL')) return 196; // Red
  if (upper.includes('WARN') || upper.includes('CAUTION')) return 214; // Orange
  if (upper.includes('SUCCESS') || upper.includes('PASS') || upper.includes('OK')) return 34; // Green
  if (upper.includes('INFO') || upper.includes('NOTE')) return 33; // Blue
  return 135; // Purple (default accent)
}

// Formatter options
export interface FormatterOptions {
  enabled: boolean;
  preserveExistingAnsi: boolean;
  semanticColors: boolean;
}

const defaultOptions: FormatterOptions = {
  enabled: true,
  preserveExistingAnsi: true,
  semanticColors: true,
};

/**
 * Main TerminalFormatter class
 * Handles streaming markdown-to-ANSI conversion with state management
 */
export class TerminalFormatter {
  private buffer: string = '';
  private options: FormatterOptions;

  // Pre-compiled regex patterns (Fix 10: avoid recompilation per line)
  private static readonly RE_ANSI = /\x1b\[/;
  private static readonly RE_H3 = /^###\s+(.+)$/;
  private static readonly RE_H2 = /^##\s+(.+)$/;
  private static readonly RE_H1 = /^#\s+(.+)$/;
  private static readonly RE_BOLD = /\*\*([^*]+)\*\*/g;
  private static readonly RE_ITALIC_AST = /(?<!\*)\*([^*]+)\*(?!\*)/g;
  private static readonly RE_ITALIC_UND = /_([^_]+)_/g;
  private static readonly RE_INLINE_CODE = /`([^`]+)`/g;
  private static readonly RE_QUOTE = /^>\s+(.+)$/;
  private static readonly RE_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
  private static readonly RE_BADGE = /\[([^\]]{1,20})\](?!\()/g; // Fix 1: negative lookahead avoids links
  private static readonly RE_DIVIDER = /^[-*]{3,}$/;
  private static readonly RE_BULLET = /^(\s*)(•|-|\*)\s+(.+)$/;
  private static readonly RE_NUMBERED = /^(\s*)(\d+)\.\s+(.+)$/;
  private static readonly RE_EMOJI = /[\u{1F300}-\u{1F9FF}]/u;

  // Fix 4: Buffer size protection
  private static readonly MAX_BUFFER_SIZE = 4096;

  constructor(options: Partial<FormatterOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Format a chunk of terminal data
   * Handles incomplete markdown tokens across chunks
   */
  format(chunk: string): string {
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
  private formatLine(line: string): string {
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
  private formatHeaders(line: string): string {
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

  private formatBold(line: string): string {
    TerminalFormatter.RE_BOLD.lastIndex = 0;
    return line.replace(TerminalFormatter.RE_BOLD, (_, text) => {
      return `${ansi.bold}${text}${ansi.reset}`;
    });
  }

  private formatItalic(line: string): string {
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

  private formatInlineCode(line: string): string {
    TerminalFormatter.RE_INLINE_CODE.lastIndex = 0;
    return line.replace(TerminalFormatter.RE_INLINE_CODE, (_, code) => {
      return `${ansi.bg(COLORS.CODE_BG)}${ansi.fg(COLORS.CODE_FG)} ${code} ${ansi.reset}`;
    });
  }

  private formatQuotes(line: string): string {
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
  private formatLinks(line: string): string {
    TerminalFormatter.RE_LINK.lastIndex = 0;
    return line.replace(TerminalFormatter.RE_LINK, (_, text, url) => {
      return `${ansi.underlineFg(COLORS.LINK)}${text}${ansi.reset} ${ansi.fg(COLORS.TEXT_DIM)}(${url})${ansi.reset}`;
    });
  }

  /**
   * Format badges: [TAG] or [emoji] - negative lookahead prevents matching links
   */
  private formatBadges(line: string): string {
    TerminalFormatter.RE_BADGE.lastIndex = 0;
    return line.replace(TerminalFormatter.RE_BADGE, (_, content) => {
      if (TerminalFormatter.RE_EMOJI.test(content)) {
        return `${ansi.bg(COLORS.BADGE_BG)}${content}${ansi.reset}`;
      }
      const color = getBadgeColor(content);
      return `${ansi.bg(color)}${ansi.fg(255)} ${content} ${ansi.reset}`;
    });
  }

  private formatDividers(line: string): string {
    if (TerminalFormatter.RE_DIVIDER.test(line)) {
      return `${ansi.fg(COLORS.DIVIDER)}${'━'.repeat(60)}${ansi.reset}`;
    }
    return line;
  }

  /**
   * Format bullet lists: • Item or - Item or * Item
   * Runs BEFORE italic to prevent * conflicts
   */
  private formatBullets(line: string): string {
    if (TerminalFormatter.RE_BULLET.test(line)) {
      return line.replace(TerminalFormatter.RE_BULLET, (_, indent, _marker, text) => {
        return `${indent}${ansi.fg(COLORS.LIST_BULLET)}•${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${text}${ansi.reset}`;
      });
    }
    return line;
  }

  private formatNumberedLists(line: string): string {
    if (TerminalFormatter.RE_NUMBERED.test(line)) {
      return line.replace(TerminalFormatter.RE_NUMBERED, (_, indent, num, text) => {
        return `${indent}${ansi.fg(COLORS.HEADER_2)}${num}.${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${text}${ansi.reset}`;
      });
    }
    return line;
  }

  reset(): void {
    this.buffer = '';
  }

  flush(): string {
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
  header1(text: string): string {
    return `\n\n${ansi.boldFg(COLORS.HEADER_1)}${text}${ansi.reset}\n${ansi.fg(COLORS.TEXT_DIM)}${'─'.repeat(text.length)}${ansi.reset}\n`;
  },

  /**
   * Format as H2 header
   */
  header2(text: string): string {
    return `\n${ansi.boldFg(COLORS.HEADER_2)}▸ ${text}${ansi.reset}\n`;
  },

  /**
   * Format as H3 header
   */
  header3(text: string): string {
    return `${ansi.fg(COLORS.HEADER_3)}• ${text}${ansi.reset}\n`;
  },

  /**
   * Format as paragraph with text wrapping
   */
  paragraph(text: string, width: number = 72): string {
    const wrapped = wrapText(text, width);
    return `${ansi.fg(COLORS.TEXT_PRIMARY)}${wrapped}${ansi.reset}\n`;
  },

  /**
   * Format as quote block
   */
  quote(text: string): string {
    const lines = text.split('\n');
    return lines
      .map(line => `${ansi.fg(COLORS.QUOTE_BORDER)}│${ansi.reset} ${ansi.italicFg(COLORS.QUOTE_FG)}${line}${ansi.reset}`)
      .join('\n') + '\n';
  },

  /**
   * Format as inline code
   */
  code(text: string): string {
    return `${ansi.bg(COLORS.CODE_BG)}${ansi.fg(COLORS.CODE_FG)} ${text} ${ansi.reset}`;
  },

  /**
   * Format as code block
   */
  codeBlock(code: string): string {
    const lines = code.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length)) + 4;
    const top = `${ansi.fg(COLORS.TEXT_DIM)}┌${'─'.repeat(maxLen)}┐${ansi.reset}`;
    const bottom = `${ansi.fg(COLORS.TEXT_DIM)}└${'─'.repeat(maxLen)}┘${ansi.reset}`;
    const content = lines.map(line =>
      `${ansi.fg(COLORS.TEXT_DIM)}│${ansi.reset} ${ansi.fg(COLORS.CODE_FG)}${line.padEnd(maxLen - 2)}${ansi.reset} ${ansi.fg(COLORS.TEXT_DIM)}│${ansi.reset}`
    ).join('\n');
    return `\n${top}\n${content}\n${bottom}\n`;
  },

  /**
   * Format as badge
   */
  badge(text: string, colorCode?: number): string {
    const color = colorCode || getBadgeColor(text);
    return `${ansi.bg(color)}${ansi.fg(255)} ${text} ${ansi.reset}`;
  },

  /**
   * Format multiple tags
   */
  tags(tags: string[]): string {
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
  divider(width: number = 80): string {
    return `\n${ansi.fg(COLORS.DIVIDER)}${'━'.repeat(width)}${ansi.reset}\n`;
  },

  /**
   * Format as metadata/secondary text
   */
  metadata(text: string): string {
    return `${ansi.dim}${ansi.fg(COLORS.TEXT_DIM)}${text}${ansi.reset}\n`;
  },

  /**
   * Format as bullet list
   */
  bulletList(items: string[]): string {
    return items
      .map(item => `  ${ansi.fg(COLORS.LIST_BULLET)}•${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${item}${ansi.reset}`)
      .join('\n') + '\n';
  },

  /**
   * Format as numbered list
   */
  numberedList(items: string[]): string {
    return items
      .map((item, i) => `  ${ansi.fg(COLORS.HEADER_2)}${i + 1}.${ansi.reset} ${ansi.fg(COLORS.TEXT_PRIMARY)}${item}${ansi.reset}`)
      .join('\n') + '\n';
  },
};

/**
 * Wrap text to specified width
 */
function wrapText(text: string, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > width) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }

  if (currentLine) lines.push(currentLine.trim());
  return lines.join('\n');
}

// Export for convenience
export { COLORS, ansi };
