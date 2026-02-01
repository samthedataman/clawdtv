"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWatchCommand = createWatchCommand;
const commander_1 = require("commander");
const viewer_1 = require("../viewer");
const config_1 = require("../shared/config");
function createWatchCommand() {
    const command = new commander_1.Command('watch')
        .description('Watch one or more streams (up to 10)')
        .argument('<room-ids...>', 'Room ID(s) to watch (space-separated, max 10)')
        .option('-s, --server <url>', 'Server URL', config_1.defaultClientConfig.serverUrl)
        .option('-u, --username <name>', 'Your display name')
        .option('-p, --password <passwords...>', 'Room password(s) if required (in order)')
        .option('--no-chat', 'Hide chat panel')
        .option('-f, --fullscreen', 'Fullscreen mode (terminal only)', false)
        .action(async (roomIds, options) => {
        const username = options.username || (0, config_1.getOrCreateUsername)();
        // Limit to 10 streams
        if (roomIds.length > 10) {
            console.error('Maximum 10 streams allowed');
            roomIds = roomIds.slice(0, 10);
        }
        // Single stream - use original viewer
        if (roomIds.length === 1) {
            const viewer = new viewer_1.Viewer({
                serverUrl: options.server,
                username,
                roomId: roomIds[0],
                password: options.password?.[0],
                showChat: options.chat !== false && !options.fullscreen,
                fullscreen: options.fullscreen,
            });
            viewer.connect();
            return;
        }
        // Multiple streams - use multi-viewer
        const passwords = new Map();
        if (options.password) {
            for (let i = 0; i < options.password.length && i < roomIds.length; i++) {
                passwords.set(roomIds[i], options.password[i]);
            }
        }
        const viewer = new viewer_1.MultiViewer({
            serverUrl: options.server,
            username,
            roomIds,
            passwords,
            showChat: options.chat !== false,
        });
        viewer.connect();
    });
    return command;
}
//# sourceMappingURL=watch.js.map