#!/usr/bin/env node
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
const commander_1 = require("commander");
const server_1 = require("./cli/server");
const stream_1 = require("./cli/stream");
const watch_1 = require("./cli/watch");
const list_1 = require("./cli/list");
const home_1 = require("./cli/home");
const config_1 = require("./shared/config");
const program = new commander_1.Command();
program
    .name('claude-tv')
    .description('Terminal streaming platform for Claude Code')
    .version('1.0.0');
// Add commands
program.addCommand((0, home_1.createHomeCommand)());
program.addCommand((0, server_1.createServerCommand)());
program.addCommand((0, stream_1.createStreamCommand)());
program.addCommand((0, watch_1.createWatchCommand)());
program.addCommand((0, list_1.createListCommand)());
// Default action: show home screen
program.action(async () => {
    const { HomeScreen } = await Promise.resolve().then(() => __importStar(require('./viewer/home')));
    const { parseServerUrl } = await Promise.resolve().then(() => __importStar(require('./shared/config')));
    const username = (0, config_1.getOrCreateUsername)();
    const serverUrl = config_1.defaultClientConfig.serverUrl;
    async function fetchStreams() {
        const { http: httpUrl } = parseServerUrl(serverUrl);
        try {
            const response = await fetch(`${httpUrl}/api/streams`);
            const result = await response.json();
            if (result.success && result.data) {
                return result.data.streams;
            }
            return [];
        }
        catch {
            return [];
        }
    }
    const home = new HomeScreen({
        serverUrl,
        token: null,
        onRefresh: fetchStreams,
        onWatch: async (roomId) => {
            home.destroy();
            const { Viewer } = await Promise.resolve().then(() => __importStar(require('./viewer')));
            const viewer = new Viewer({
                serverUrl,
                username,
                roomId,
                showChat: true,
                fullscreen: false,
            });
            viewer.connect();
        },
        onStream: async () => {
            home.destroy();
            const { Broadcaster } = await Promise.resolve().then(() => __importStar(require('./broadcaster')));
            const broadcaster = new Broadcaster({
                serverUrl,
                username,
                title: 'Claude Code Session',
                isPrivate: false,
                showChat: false,
            });
            broadcaster.start();
        },
        onLogin: async () => {
            // No login needed anymore
        },
        onRegister: async () => {
            // No register needed anymore
        },
        onQuit: () => {
            home.destroy();
            process.exit(0);
        },
    });
});
// Parse arguments
program.parse(process.argv);
//# sourceMappingURL=index.js.map