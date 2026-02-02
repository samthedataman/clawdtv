import { ServerConfig, ClientConfig } from './types';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Default server configuration
export const defaultServerConfig: ServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  dbPath: './claude-tv.db',
  jwtSecret: process.env.CLAUDE_TV_JWT_SECRET || 'change-this-secret-in-production',
  jwtExpiresIn: '7d',
};

// Default client configuration - points to public server
export const defaultClientConfig: ClientConfig = {
  serverUrl: process.env.CLAUDE_TV_SERVER || 'https://clawdtv.com',
};

// Get config directory path
export function getConfigDir(): string {
  const configDir = path.join(os.homedir(), '.claude-tv');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return configDir;
}

// Get token file path
export function getTokenPath(): string {
  return path.join(getConfigDir(), 'token');
}

// Get username file path
export function getUsernamePath(): string {
  return path.join(getConfigDir(), 'username');
}

// Save auth token
export function saveToken(token: string): void {
  fs.writeFileSync(getTokenPath(), token, { mode: 0o600 });
}

// Load auth token
export function loadToken(): string | null {
  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    return fs.readFileSync(tokenPath, 'utf-8').trim();
  }
  return null;
}

// Clear auth token
export function clearToken(): void {
  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }
}

// Save username (for anonymous mode)
export function saveUsername(username: string): void {
  fs.writeFileSync(getUsernamePath(), username, { mode: 0o600 });
}

// Load username
export function loadUsername(): string | null {
  const path = getUsernamePath();
  if (fs.existsSync(path)) {
    return fs.readFileSync(path, 'utf-8').trim();
  }
  return null;
}

// Generate random username
export function generateUsername(): string {
  const adjectives = ['swift', 'clever', 'bright', 'cosmic', 'cyber', 'digital', 'epic', 'hyper', 'mega', 'neo', 'pixel', 'quantum', 'rad', 'super', 'turbo', 'ultra', 'zen'];
  const nouns = ['coder', 'dev', 'hacker', 'ninja', 'wizard', 'fox', 'wolf', 'hawk', 'tiger', 'dragon', 'phoenix', 'falcon', 'shark', 'bear', 'lion', 'eagle'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}${noun}${num}`;
}

// Get or create username
export function getOrCreateUsername(): string {
  let username = loadUsername();
  if (!username) {
    username = generateUsername();
    saveUsername(username);
  }
  return username;
}

// Get client config with saved token
export function getClientConfig(): ClientConfig {
  return {
    ...defaultClientConfig,
    token: loadToken() || undefined,
  };
}

// Parse server URL to get WebSocket and HTTP URLs
export function parseServerUrl(url: string): { ws: string; http: string } {
  const wsUrl = url.replace(/^http/, 'ws');
  const httpUrl = url.replace(/^ws/, 'http');
  return { ws: wsUrl, http: httpUrl };
}

// Environment variable helpers
export function getEnvPort(): number {
  // Support both CLAUDE_TV_PORT and PORT (for Render/Heroku)
  const port = process.env.CLAUDE_TV_PORT || process.env.PORT;
  return port ? parseInt(port, 10) : defaultServerConfig.port;
}

export function getEnvHost(): string {
  return process.env.CLAUDE_TV_HOST || defaultServerConfig.host;
}

export function getEnvDbPath(): string {
  return process.env.CLAUDE_TV_DB_PATH || defaultServerConfig.dbPath;
}

// Build server config from environment and options
export function buildServerConfig(options: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: options.port ?? getEnvPort(),
    host: options.host ?? getEnvHost(),
    dbPath: options.dbPath ?? getEnvDbPath(),
    jwtSecret: options.jwtSecret ?? defaultServerConfig.jwtSecret,
    jwtExpiresIn: options.jwtExpiresIn ?? defaultServerConfig.jwtExpiresIn,
  };
}

// Constants
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const HEARTBEAT_TIMEOUT = 45000; // 45 seconds
export const RECONNECT_DELAY = 3000; // 3 seconds
export const MAX_RECONNECT_ATTEMPTS = 5;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const MAX_RECENT_MESSAGES = 50;
export const DEFAULT_SLOW_MODE = 0; // seconds, 0 = off
export const BCRYPT_ROUNDS = 12;
