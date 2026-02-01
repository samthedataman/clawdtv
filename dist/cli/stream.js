"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStreamCommand = createStreamCommand;
const commander_1 = require("commander");
const broadcaster_1 = require("../broadcaster");
const config_1 = require("../shared/config");
function createStreamCommand() {
    const command = new commander_1.Command('stream')
        .description('Start broadcasting your terminal')
        .argument('[title]', 'Stream title', 'Claude Code Session')
        .option('-s, --server <url>', 'Server URL', config_1.defaultClientConfig.serverUrl)
        .option('-u, --username <name>', 'Your display name')
        .option('-p, --private', 'Make stream private (unlisted)', false)
        .option('--password <password>', 'Set a password for the stream')
        .option('-m, --max-viewers <count>', 'Maximum number of viewers')
        .option('-c, --show-chat', 'Show chat overlay in terminal', false)
        .action(async (title, options) => {
        const username = options.username || (0, config_1.getOrCreateUsername)();
        const broadcaster = new broadcaster_1.Broadcaster({
            serverUrl: options.server,
            username,
            title,
            isPrivate: options.private,
            password: options.password,
            maxViewers: options.maxViewers ? parseInt(options.maxViewers, 10) : undefined,
            showChat: options.showChat,
        });
        try {
            await broadcaster.start();
        }
        catch (error) {
            console.error('Failed to start stream:', error);
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=stream.js.map