import { Command } from 'commander';
import { startServer } from '../server';
import { buildServerConfig } from '../shared/config';

export function createServerCommand(): Command {
  const command = new Command('server')
    .description('Start the clawdtv.com server')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
    .option('-d, --db-path <path>', 'Path to SQLite database', './claude-tv.db')
    .action(async (options) => {
      const config = buildServerConfig({
        port: parseInt(options.port, 10),
        host: options.host,
        dbPath: options.dbPath,
      });

      try {
        const server = await startServer(config);

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
      } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
      }
    });

  return command;
}
