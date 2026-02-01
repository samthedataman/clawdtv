"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServerCommand = createServerCommand;
const commander_1 = require("commander");
const server_1 = require("../server");
const config_1 = require("../shared/config");
function createServerCommand() {
    const command = new commander_1.Command('server')
        .description('Start the claude.tv server')
        .option('-p, --port <port>', 'Port to listen on', '3000')
        .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
        .option('-d, --db-path <path>', 'Path to SQLite database', './claude-tv.db')
        .action(async (options) => {
        const config = (0, config_1.buildServerConfig)({
            port: parseInt(options.port, 10),
            host: options.host,
            dbPath: options.dbPath,
        });
        try {
            const server = await (0, server_1.startServer)(config);
            // Handle shutdown
            process.on('SIGINT', async () => {
                console.log('\nShutting down...');
                await server.close();
                process.exit(0);
            });
            process.on('SIGTERM', async () => {
                console.log('\nShutting down...');
                await server.close();
                process.exit(0);
            });
        }
        catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=server.js.map