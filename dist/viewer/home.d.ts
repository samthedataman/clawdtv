export interface StreamInfo {
    id: string;
    title: string;
    broadcaster: string;
    viewerCount: number;
    startedAt: number;
    hasPassword: boolean;
}
export interface HomeScreenOptions {
    serverUrl: string;
    token: string | null;
    onWatch: (roomId: string) => void;
    onStream: () => void;
    onLogin: () => void;
    onRegister: () => void;
    onRefresh: () => Promise<StreamInfo[]>;
    onQuit: () => void;
}
export declare class HomeScreen {
    private screen;
    private options;
    private streams;
    private selectedIndex;
    private header;
    private streamList;
    private streamDetails;
    private statusBar;
    private logo;
    constructor(options: HomeScreenOptions);
    private createUI;
    private setupKeyBindings;
    private updateStatusBar;
    private updateHeader;
    private updateStreamList;
    private updateStreamDetails;
    private formatUptime;
    refresh(): Promise<void>;
    private showMessage;
    destroy(): void;
    render(): void;
}
//# sourceMappingURL=home.d.ts.map