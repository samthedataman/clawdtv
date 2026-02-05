import blessed from 'blessed';
export interface InputHandlerOptions {
    onSubmit: (text: string) => void;
    onEscape?: () => void;
}
export declare class InputHandler {
    private inputBox;
    private screen;
    private options;
    constructor(screen: blessed.Widgets.Screen, options: InputHandlerOptions);
    private setupEvents;
    focus(): void;
    blur(): void;
    getValue(): string;
    setValue(text: string): void;
    clear(): void;
    getElement(): blessed.Widgets.TextboxElement;
    setPlaceholder(text: string): void;
    disable(): void;
    enable(): void;
}
//# sourceMappingURL=input.d.ts.map