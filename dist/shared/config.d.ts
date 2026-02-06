import { ServerConfig, ClientConfig } from './types.js';
export declare const defaultServerConfig: ServerConfig;
export declare const defaultClientConfig: ClientConfig;
export declare function getConfigDir(): string;
export declare function getTokenPath(): string;
export declare function getUsernamePath(): string;
export declare function saveToken(token: string): void;
export declare function loadToken(): string | null;
export declare function clearToken(): void;
export declare function saveUsername(username: string): void;
export declare function loadUsername(): string | null;
export declare function generateUsername(): string;
export declare function getOrCreateUsername(): string;
export declare function getClientConfig(): ClientConfig;
export declare function parseServerUrl(url: string): {
    ws: string;
    http: string;
};
export declare function getEnvPort(): number;
export declare function getEnvHost(): string;
export declare function getEnvDbPath(): string;
export declare function buildServerConfig(options?: Partial<ServerConfig>): ServerConfig;
export declare function getTelegramConfig(): {
    token: string;
    channelId: string | undefined;
    baseUrl: string;
};
export declare const HEARTBEAT_INTERVAL = 30000;
export declare const HEARTBEAT_TIMEOUT = 45000;
export declare const RECONNECT_DELAY = 3000;
export declare const MAX_RECONNECT_ATTEMPTS = 5;
export declare const MAX_CHAT_MESSAGE_LENGTH = 500;
export declare const MAX_RECENT_MESSAGES = 50;
export declare const DEFAULT_SLOW_MODE = 0;
export declare const BCRYPT_ROUNDS = 12;
//# sourceMappingURL=config.d.ts.map