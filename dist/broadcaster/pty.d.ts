import { EventEmitter } from 'events';
import { TerminalSize } from '../shared/types.js';
export interface PtyEvents {
    data: (data: string) => void;
    exit: (code: number, signal?: number) => void;
    resize: (size: TerminalSize) => void;
}
export declare class PtyCapture extends EventEmitter {
    private ptyProcess;
    private size;
    private shell;
    constructor(shell?: string);
    start(): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    private handleResize;
    getSize(): TerminalSize;
    kill(): void;
    getPid(): number | undefined;
}
//# sourceMappingURL=pty.d.ts.map