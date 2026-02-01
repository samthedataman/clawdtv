import { Command } from 'commander';
import { Broadcaster } from '../broadcaster';
import { getOrCreateUsername, defaultClientConfig } from '../shared/config';

export function createStreamCommand(): Command {
  const command = new Command('stream')
    .description('Start broadcasting your terminal')
    .argument('[title]', 'Stream title', 'Claude Code Session')
    .option('-s, --server <url>', 'Server URL', defaultClientConfig.serverUrl)
    .option('-u, --username <name>', 'Your display name')
    .option('-p, --private', 'Make stream private (unlisted)', false)
    .option('--password <password>', 'Set a password for the stream')
    .option('-m, --max-viewers <count>', 'Maximum number of viewers')
    .option('-c, --show-chat', 'Show chat overlay in terminal', false)
    .action(async (title, options) => {
      const username = options.username || getOrCreateUsername();

      const broadcaster = new Broadcaster({
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
      } catch (error) {
        console.error('Failed to start stream:', error);
        process.exit(1);
      }
    });

  return command;
}
