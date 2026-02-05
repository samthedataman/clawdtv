/**
 * Terminal Formatter: Markdown-to-ANSI Parser
 *
 * Converts markdown-like syntax into rich ANSI escape codes for terminal display.
 * Supports streaming with state management for incomplete tokens across chunks.
 */
declare const COLORS: {
    readonly HEADER_1: 75;
    readonly HEADER_2: 117;
    readonly HEADER_3: 153;
    readonly TEXT_PRIMARY: 252;
    readonly TEXT_SECONDARY: 248;
    readonly TEXT_DIM: 240;
    readonly SUCCESS: 120;
    readonly WARNING: 221;
    readonly ERROR: 210;
    readonly INFO: 117;
    readonly CODE_FG: 156;
    readonly CODE_BG: 235;
    readonly QUOTE_FG: 248;
    readonly QUOTE_BORDER: 244;
    readonly BADGE_BG: 235;
    readonly BADGE_FG: readonly [117, 153, 75];
    readonly DIVIDER: 240;
    readonly LIST_BULLET: 75;
    readonly LINK: 75;
};
declare const ansi: {
    reset: string;
    bold: string;
    dim: string;
    italic: string;
    underline: string;
    fg: (code: number) => string;
    bg: (code: number) => string;
    boldFg: (code: number) => string;
    italicFg: (code: number) => string;
    underlineFg: (code: number) => string;
};
export interface FormatterOptions {
    enabled: boolean;
    preserveExistingAnsi: boolean;
    semanticColors: boolean;
}
/**
 * Main TerminalFormatter class
 * Handles streaming markdown-to-ANSI conversion with state management
 */
export declare class TerminalFormatter {
    private buffer;
    private options;
    private static readonly RE_ANSI;
    private static readonly RE_H3;
    private static readonly RE_H2;
    private static readonly RE_H1;
    private static readonly RE_BOLD;
    private static readonly RE_ITALIC_AST;
    private static readonly RE_ITALIC_UND;
    private static readonly RE_INLINE_CODE;
    private static readonly RE_QUOTE;
    private static readonly RE_LINK;
    private static readonly RE_BADGE;
    private static readonly RE_DIVIDER;
    private static readonly RE_BULLET;
    private static readonly RE_NUMBERED;
    private static readonly RE_EMOJI;
    private static readonly MAX_BUFFER_SIZE;
    constructor(options?: Partial<FormatterOptions>);
    /**
     * Format a chunk of terminal data
     * Handles incomplete markdown tokens across chunks
     */
    format(chunk: string): string;
    /**
     * Format a single line
     * Order matters: structural patterns first, then inline formatting
     */
    private formatLine;
    /**
     * Format headers: ### first (most specific), then ##, then #
     */
    private formatHeaders;
    private formatBold;
    private formatItalic;
    private formatInlineCode;
    private formatQuotes;
    /**
     * Format links: [text](url) - MUST run before formatBadges
     */
    private formatLinks;
    /**
     * Format badges: [TAG] or [emoji] - negative lookahead prevents matching links
     */
    private formatBadges;
    private formatDividers;
    /**
     * Format bullet lists: • Item or - Item or * Item
     * Runs BEFORE italic to prevent * conflicts
     */
    private formatBullets;
    private formatNumberedLists;
    reset(): void;
    flush(): string;
}
/**
 * Quick utility functions for manual formatting
 */
export declare const fmt: {
    /**
     * Format as H1 header
     */
    header1(text: string): string;
    /**
     * Format as H2 header
     */
    header2(text: string): string;
    /**
     * Format as H3 header
     */
    header3(text: string): string;
    /**
     * Format as paragraph with text wrapping
     */
    paragraph(text: string, width?: number): string;
    /**
     * Format as quote block
     */
    quote(text: string): string;
    /**
     * Format as inline code
     */
    code(text: string): string;
    /**
     * Format as code block
     */
    codeBlock(code: string): string;
    /**
     * Format as badge
     */
    badge(text: string, colorCode?: number): string;
    /**
     * Format multiple tags
     */
    tags(tags: string[]): string;
    /**
     * Format as horizontal divider
     */
    divider(width?: number): string;
    /**
     * Format as metadata/secondary text
     */
    metadata(text: string): string;
    /**
     * Format as bullet list
     */
    bulletList(items: string[]): string;
    /**
     * Format as numbered list
     */
    numberedList(items: string[]): string;
};
export { COLORS, ansi };
//# sourceMappingURL=terminal-formatter.d.ts.map