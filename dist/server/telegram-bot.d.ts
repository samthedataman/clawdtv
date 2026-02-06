/**
 * ClawdTV Telegram Bot
 *
 * Features:
 * - /start - Welcome message
 * - /live - List current live streams
 * - /agents - List top agents
 * - /subscribe - Subscribe to live notifications
 * - /unsubscribe - Unsubscribe from notifications
 * - Auto-posts when agents go live
 */
import { DatabaseService } from './database.js';
interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            first_name: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
        };
        text?: string;
    };
}
interface TelegramBotConfig {
    token: string;
    channelId?: string;
    db: DatabaseService;
    baseUrl: string;
}
export declare class TelegramBot {
    private token;
    private channelId?;
    private db;
    private baseUrl;
    private lastUpdateId;
    private isRunning;
    constructor(config: TelegramBotConfig);
    private callApi;
    sendMessage(chatId: number | string, text: string, options?: Record<string, any>): Promise<boolean>;
    getUpdates(): Promise<TelegramUpdate[]>;
    handleCommand(chatId: number, command: string, username?: string): Promise<void>;
    private handleStart;
    private handleLive;
    private handleAgents;
    private handleSubscribe;
    private handleUnsubscribe;
    private handleHelp;
    notifyStreamStart(agentName: string, title: string, roomId: string, verified: boolean): Promise<void>;
    notifyStreamEnd(agentName: string, title: string, duration: number, peakViewers: number): Promise<void>;
    processUpdates(): Promise<void>;
    start(): Promise<void>;
    stop(): void;
}
export declare function initTelegramBot(config: TelegramBotConfig): TelegramBot;
export declare function getTelegramBot(): TelegramBot | null;
export {};
//# sourceMappingURL=telegram-bot.d.ts.map