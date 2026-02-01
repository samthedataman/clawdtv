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
exports.BCRYPT_ROUNDS = exports.DEFAULT_SLOW_MODE = exports.MAX_RECENT_MESSAGES = exports.MAX_CHAT_MESSAGE_LENGTH = exports.MAX_RECONNECT_ATTEMPTS = exports.RECONNECT_DELAY = exports.HEARTBEAT_TIMEOUT = exports.HEARTBEAT_INTERVAL = exports.defaultClientConfig = exports.defaultServerConfig = void 0;
exports.getConfigDir = getConfigDir;
exports.getTokenPath = getTokenPath;
exports.getUsernamePath = getUsernamePath;
exports.saveToken = saveToken;
exports.loadToken = loadToken;
exports.clearToken = clearToken;
exports.saveUsername = saveUsername;
exports.loadUsername = loadUsername;
exports.generateUsername = generateUsername;
exports.getOrCreateUsername = getOrCreateUsername;
exports.getClientConfig = getClientConfig;
exports.parseServerUrl = parseServerUrl;
exports.getEnvPort = getEnvPort;
exports.getEnvHost = getEnvHost;
exports.getEnvDbPath = getEnvDbPath;
exports.buildServerConfig = buildServerConfig;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
// Default server configuration
exports.defaultServerConfig = {
    port: 3000,
    host: '0.0.0.0',
    dbPath: './claude-tv.db',
    jwtSecret: process.env.CLAUDE_TV_JWT_SECRET || 'change-this-secret-in-production',
    jwtExpiresIn: '7d',
};
// Default client configuration - points to public server
exports.defaultClientConfig = {
    serverUrl: process.env.CLAUDE_TV_SERVER || 'https://claude-tv.onrender.com',
};
// Get config directory path
function getConfigDir() {
    const configDir = path.join(os.homedir(), '.claude-tv');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    return configDir;
}
// Get token file path
function getTokenPath() {
    return path.join(getConfigDir(), 'token');
}
// Get username file path
function getUsernamePath() {
    return path.join(getConfigDir(), 'username');
}
// Save auth token
function saveToken(token) {
    fs.writeFileSync(getTokenPath(), token, { mode: 0o600 });
}
// Load auth token
function loadToken() {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
        return fs.readFileSync(tokenPath, 'utf-8').trim();
    }
    return null;
}
// Clear auth token
function clearToken() {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
    }
}
// Save username (for anonymous mode)
function saveUsername(username) {
    fs.writeFileSync(getUsernamePath(), username, { mode: 0o600 });
}
// Load username
function loadUsername() {
    const path = getUsernamePath();
    if (fs.existsSync(path)) {
        return fs.readFileSync(path, 'utf-8').trim();
    }
    return null;
}
// Generate random username
function generateUsername() {
    const adjectives = ['swift', 'clever', 'bright', 'cosmic', 'cyber', 'digital', 'epic', 'hyper', 'mega', 'neo', 'pixel', 'quantum', 'rad', 'super', 'turbo', 'ultra', 'zen'];
    const nouns = ['coder', 'dev', 'hacker', 'ninja', 'wizard', 'fox', 'wolf', 'hawk', 'tiger', 'dragon', 'phoenix', 'falcon', 'shark', 'bear', 'lion', 'eagle'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 999);
    return `${adj}${noun}${num}`;
}
// Get or create username
function getOrCreateUsername() {
    let username = loadUsername();
    if (!username) {
        username = generateUsername();
        saveUsername(username);
    }
    return username;
}
// Get client config with saved token
function getClientConfig() {
    return {
        ...exports.defaultClientConfig,
        token: loadToken() || undefined,
    };
}
// Parse server URL to get WebSocket and HTTP URLs
function parseServerUrl(url) {
    const wsUrl = url.replace(/^http/, 'ws');
    const httpUrl = url.replace(/^ws/, 'http');
    return { ws: wsUrl, http: httpUrl };
}
// Environment variable helpers
function getEnvPort() {
    // Support both CLAUDE_TV_PORT and PORT (for Render/Heroku)
    const port = process.env.CLAUDE_TV_PORT || process.env.PORT;
    return port ? parseInt(port, 10) : exports.defaultServerConfig.port;
}
function getEnvHost() {
    return process.env.CLAUDE_TV_HOST || exports.defaultServerConfig.host;
}
function getEnvDbPath() {
    return process.env.CLAUDE_TV_DB_PATH || exports.defaultServerConfig.dbPath;
}
// Build server config from environment and options
function buildServerConfig(options = {}) {
    return {
        port: options.port ?? getEnvPort(),
        host: options.host ?? getEnvHost(),
        dbPath: options.dbPath ?? getEnvDbPath(),
        jwtSecret: options.jwtSecret ?? exports.defaultServerConfig.jwtSecret,
        jwtExpiresIn: options.jwtExpiresIn ?? exports.defaultServerConfig.jwtExpiresIn,
    };
}
// Constants
exports.HEARTBEAT_INTERVAL = 30000; // 30 seconds
exports.HEARTBEAT_TIMEOUT = 45000; // 45 seconds
exports.RECONNECT_DELAY = 3000; // 3 seconds
exports.MAX_RECONNECT_ATTEMPTS = 5;
exports.MAX_CHAT_MESSAGE_LENGTH = 500;
exports.MAX_RECENT_MESSAGES = 50;
exports.DEFAULT_SLOW_MODE = 0; // seconds, 0 = off
exports.BCRYPT_ROUNDS = 12;
//# sourceMappingURL=config.js.map