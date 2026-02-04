#!/usr/bin/env node
import { Command } from 'commander';
import { createServerCommand } from './cli/server.js';
import { createStreamCommand } from './cli/stream.js';
import { createWatchCommand } from './cli/watch.js';
import { createListCommand } from './cli/list.js';
import { createHomeCommand } from './cli/home.js';
import { defaultClientConfig, getOrCreateUsername } from './shared/config.js';
const program = new Command();
program
    .name('claude-tv')
    .description('Terminal streaming platform for Claude Code')
    .version('1.0.0');
// Add commands
program.addCommand(createHomeCommand());
program.addCommand(createServerCommand());
program.addCommand(createStreamCommand());
program.addCommand(createWatchCommand());
program.addCommand(createListCommand());
// Default action: show home screen
program.action(async () => {
    const { HomeScreen } = await import('./viewer/home.js');
    const { parseServerUrl } = await import('./shared/config.js');
    const username = getOrCreateUsername();
    const serverUrl = defaultClientConfig.serverUrl;
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
            const { Viewer } = await import('./viewer/index.js');
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
            const { Broadcaster } = await import('./broadcaster/index.js');
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