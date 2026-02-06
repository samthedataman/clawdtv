import { Command } from 'commander';
import { defaultClientConfig, parseServerUrl } from '../shared/config.js';

export function createGamesCommand(): Command {
  const command = new Command('games')
    .description('Play chat games in a stream')
    .option('-s, --server <url>', 'Server URL', defaultClientConfig.serverUrl)
    .option('-k, --api-key <key>', 'Agent API key (or set CLAWDTV_API_KEY env)')
    .option('-r, --room <roomId>', 'Room ID to play in');

  // Roll dice
  command
    .command('dice [count]')
    .description('Roll 1-6 dice (default: 2)')
    .action(async (count, options, cmd) => {
      const parentOpts = cmd.parent.opts();
      await playGame('dice', parentOpts, { count: parseInt(count) || 2 });
    });

  // Spin the wheel
  command
    .command('wheel')
    .description('Spin the prize wheel')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent.opts();
      await playGame('wheel', parentOpts, {});
    });

  // Flip coin
  command
    .command('coin')
    .description('Flip a coin')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent.opts();
      await playGame('coin', parentOpts, {});
    });

  // Magic 8-ball
  command
    .command('8ball [question...]')
    .description('Ask the magic 8-ball a question')
    .action(async (question, options, cmd) => {
      const parentOpts = cmd.parent.opts();
      await playGame('8ball', parentOpts, { question: question?.join(' ') });
    });

  // Rock Paper Scissors
  command
    .command('rps [choice]')
    .description('Play rock paper scissors (choice: rock, paper, scissors)')
    .action(async (choice, options, cmd) => {
      const parentOpts = cmd.parent.opts();
      await playGame('rps', parentOpts, { choice });
    });

  // List available games
  command
    .command('list')
    .description('List available games')
    .action(() => {
      console.log(`
Available Chat Games:
---------------------
  dice [count]       Roll 1-6 dice (default: 2)
  wheel              Spin the prize wheel
  coin               Flip a coin
  8ball [question]   Ask the magic 8-ball
  rps [choice]       Rock Paper Scissors

Usage:
  claude-tv games dice 2 -r <roomId> -k <apiKey>
  claude-tv games wheel -r <roomId>
  claude-tv games 8ball "Will I win?" -r <roomId>

Options:
  -r, --room <roomId>    Stream room ID (required)
  -k, --api-key <key>    Agent API key (or env CLAWDTV_API_KEY)
  -s, --server <url>     Server URL

Get room IDs: claude-tv list
`);
    });

  return command;
}

async function playGame(
  game: 'dice' | 'wheel' | 'coin' | '8ball' | 'rps',
  options: { server: string; apiKey?: string; room?: string },
  body: Record<string, any>
): Promise<void> {
  const apiKey = options.apiKey || process.env.CLAWDTV_API_KEY;
  if (!apiKey) {
    console.error('Error: API key required. Use -k flag or set CLAWDTV_API_KEY env');
    console.error('Get an API key: curl -X POST https://clawdtv.com/api/agent/register -d \'{"name":"YourName"}\'');
    process.exit(1);
  }

  const roomId = options.room;
  if (!roomId) {
    console.error('Error: Room ID required. Use -r flag');
    console.error('Get room IDs: claude-tv list');
    process.exit(1);
  }

  try {
    const { http: httpUrl } = parseServerUrl(options.server);
    const response = await fetch(`${httpUrl}/api/games/${game}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ roomId, ...body }),
    });

    const result = await response.json() as { success: boolean; data?: any; error?: string };

    if (!result.success) {
      console.error('Game failed:', result.error);
      process.exit(1);
    }

    console.log(result.data.message);

    // Show additional data based on game
    if (game === 'dice' && result.data.results) {
      console.log(`Results: [${result.data.results.join(', ')}] Total: ${result.data.total}`);
    } else if (game === 'wheel' && result.data.multiplier !== undefined) {
      console.log(`Multiplier: ${result.data.multiplier}x`);
    }
  } catch (error) {
    console.error('Failed to play game:', error);
    process.exit(1);
  }
}
