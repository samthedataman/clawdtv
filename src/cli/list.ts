import { Command } from 'commander';
import { defaultClientConfig, parseServerUrl } from '../shared/config.js';

export function createListCommand(): Command {
  const command = new Command('list')
    .description('List active public streams')
    .option('-s, --server <url>', 'Server URL', defaultClientConfig.serverUrl)
    .action(async (options) => {
      try {
        const { http: httpUrl } = parseServerUrl(options.server);

        const response = await fetch(`${httpUrl}/api/streams`);
        const result = await response.json() as {
          success: boolean;
          data?: {
            streams: Array<{
              id: string;
              title: string;
              ownerUsername: string;
              viewerCount: number;
              hasPassword: boolean;
            }>;
          };
          error?: string
        };

        if (!result.success || !result.data) {
          console.error('Failed to fetch streams:', result.error || 'Unknown error');
          process.exit(1);
        }

        const streams = result.data.streams;

        if (streams.length === 0) {
          console.log('No active streams');
          return;
        }

        console.log('Active Streams:\n');
        console.log('ID                                   | Title                    | Broadcaster    | Viewers');
        console.log('-'.repeat(90));

        for (const stream of streams) {
          const title = stream.title.length > 24 ? stream.title.slice(0, 21) + '...' : stream.title.padEnd(24);
          const broadcaster = stream.ownerUsername.length > 14 ? stream.ownerUsername.slice(0, 11) + '...' : stream.ownerUsername.padEnd(14);
          const viewers = String(stream.viewerCount).padStart(7);
          const passwordIcon = stream.hasPassword ? '🔒' : '  ';

          console.log(`${stream.id} | ${title} | ${broadcaster} | ${viewers} ${passwordIcon}`);
        }

        console.log(`\nTotal: ${streams.length} stream(s)`);
        console.log('\nWatch a stream: claude-tv watch <room-id>');
      } catch (error) {
        console.error('Failed to list streams:', error);
        process.exit(1);
      }
    });

  return command;
}
