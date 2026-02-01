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
exports.createHomeCommand = createHomeCommand;
exports.runHome = runHome;
const commander_1 = require("commander");
const home_1 = require("../viewer/home");
const config_1 = require("../shared/config");
const readline = __importStar(require("readline"));
async function fetchStreams(serverUrl) {
    const { http: httpUrl } = (0, config_1.parseServerUrl)(serverUrl);
    const response = await fetch(`${httpUrl}/api/streams`);
    const result = await response.json();
    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch streams');
    }
    return result.data.streams;
}
async function interactiveLogin(serverUrl) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const question = (prompt) => {
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    };
    try {
        console.clear();
        console.log('\n  === Login to claude.tv ===\n');
        const username = await question('  Username: ');
        const password = await question('  Password: ');
        rl.close();
        const { http: httpUrl } = (0, config_1.parseServerUrl)(serverUrl);
        const response = await fetch(`${httpUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const result = await response.json();
        if (result.success && result.data) {
            (0, config_1.saveToken)(result.data.token);
            return result.data.token;
        }
        else {
            console.log(`\n  Login failed: ${result.error}`);
            await new Promise(r => setTimeout(r, 2000));
            return null;
        }
    }
    catch (error) {
        rl.close();
        console.log(`\n  Login error: ${error}`);
        await new Promise(r => setTimeout(r, 2000));
        return null;
    }
}
async function interactiveRegister(serverUrl) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const question = (prompt) => {
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    };
    try {
        console.clear();
        console.log('\n  === Register for claude.tv ===\n');
        const username = await question('  Username: ');
        const password = await question('  Password: ');
        const displayName = await question('  Display name (optional): ');
        rl.close();
        const { http: httpUrl } = (0, config_1.parseServerUrl)(serverUrl);
        const response = await fetch(`${httpUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                displayName: displayName || undefined,
            }),
        });
        const result = await response.json();
        if (result.success && result.data) {
            (0, config_1.saveToken)(result.data.token);
            return result.data.token;
        }
        else {
            console.log(`\n  Registration failed: ${result.error}`);
            await new Promise(r => setTimeout(r, 2000));
            return null;
        }
    }
    catch (error) {
        rl.close();
        console.log(`\n  Registration error: ${error}`);
        await new Promise(r => setTimeout(r, 2000));
        return null;
    }
}
function createHomeCommand() {
    const command = new commander_1.Command('home')
        .description('Browse live streams (Twitch-style home screen)')
        .option('-s, --server <url>', 'Server URL', config_1.defaultClientConfig.serverUrl)
        .action(async (options) => {
        let token = (0, config_1.loadToken)();
        const home = new home_1.HomeScreen({
            serverUrl: options.server,
            token,
            onRefresh: async () => fetchStreams(options.server),
            onWatch: (roomId) => {
                home.destroy();
                // Launch viewer
                const { Viewer } = require('../viewer');
                const viewer = new Viewer({
                    serverUrl: options.server,
                    token: token,
                    roomId,
                    showChat: true,
                    fullscreen: false,
                });
                viewer.connect();
            },
            onStream: () => {
                home.destroy();
                // Launch broadcaster
                const { Broadcaster } = require('../broadcaster');
                const broadcaster = new Broadcaster({
                    serverUrl: options.server,
                    token: token,
                    title: 'Claude Code Session',
                    isPrivate: false,
                    showChat: false,
                });
                broadcaster.start();
            },
            onLogin: async () => {
                home.destroy();
                const newToken = await interactiveLogin(options.server);
                if (newToken) {
                    token = newToken;
                }
                // Restart home screen
                process.stdout.write('\x1b[2J\x1b[H'); // Clear screen
                const newHome = new home_1.HomeScreen({
                    serverUrl: options.server,
                    token,
                    onRefresh: async () => fetchStreams(options.server),
                    onWatch: (roomId) => {
                        newHome.destroy();
                        const { Viewer } = require('../viewer');
                        const viewer = new Viewer({
                            serverUrl: options.server,
                            token: token,
                            roomId,
                            showChat: true,
                            fullscreen: false,
                        });
                        viewer.connect();
                    },
                    onStream: () => {
                        newHome.destroy();
                        const { Broadcaster } = require('../broadcaster');
                        const broadcaster = new Broadcaster({
                            serverUrl: options.server,
                            token: token,
                            title: 'Claude Code Session',
                            isPrivate: false,
                            showChat: false,
                        });
                        broadcaster.start();
                    },
                    onLogin: () => { },
                    onRegister: () => { },
                    onQuit: () => process.exit(0),
                });
            },
            onRegister: async () => {
                home.destroy();
                const newToken = await interactiveRegister(options.server);
                if (newToken) {
                    token = newToken;
                }
                // Restart home screen
                process.stdout.write('\x1b[2J\x1b[H');
                const newHome = new home_1.HomeScreen({
                    serverUrl: options.server,
                    token,
                    onRefresh: async () => fetchStreams(options.server),
                    onWatch: () => { },
                    onStream: () => { },
                    onLogin: () => { },
                    onRegister: () => { },
                    onQuit: () => process.exit(0),
                });
            },
            onQuit: () => {
                home.destroy();
                process.exit(0);
            },
        });
    });
    return command;
}
// Also export for default command
async function runHome(serverUrl) {
    const command = createHomeCommand();
    await command.parseAsync(['node', 'claude-tv', 'home', '-s', serverUrl]);
}
//# sourceMappingURL=home.js.map