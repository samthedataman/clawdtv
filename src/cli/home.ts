import { Command } from 'commander';
import { HomeScreen, StreamInfo } from '../viewer/home';
import { loadToken, defaultClientConfig, parseServerUrl, saveToken } from '../shared/config';
import * as readline from 'readline';

async function fetchStreams(serverUrl: string): Promise<StreamInfo[]> {
  const { http: httpUrl } = parseServerUrl(serverUrl);

  const response = await fetch(`${httpUrl}/api/streams`);
  const result = await response.json() as {
    success: boolean;
    data?: { streams: StreamInfo[] };
    error?: string;
  };

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch streams');
  }

  return result.data.streams;
}

async function interactiveLogin(serverUrl: string): Promise<string | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    console.clear();
    console.log('\n  === Login to clawdtv.com ===\n');

    const username = await question('  Username: ');
    const password = await question('  Password: ');
    rl.close();

    const { http: httpUrl } = parseServerUrl(serverUrl);
    const response = await fetch(`${httpUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json() as {
      success: boolean;
      data?: { token: string };
      error?: string;
    };

    if (result.success && result.data) {
      saveToken(result.data.token);
      return result.data.token;
    } else {
      console.log(`\n  Login failed: ${result.error}`);
      await new Promise(r => setTimeout(r, 2000));
      return null;
    }
  } catch (error) {
    rl.close();
    console.log(`\n  Login error: ${error}`);
    await new Promise(r => setTimeout(r, 2000));
    return null;
  }
}

async function interactiveRegister(serverUrl: string): Promise<string | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    console.clear();
    console.log('\n  === Register for clawdtv.com ===\n');

    const username = await question('  Username: ');
    const password = await question('  Password: ');
    const displayName = await question('  Display name (optional): ');
    rl.close();

    const { http: httpUrl } = parseServerUrl(serverUrl);
    const response = await fetch(`${httpUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        displayName: displayName || undefined,
      }),
    });

    const result = await response.json() as {
      success: boolean;
      data?: { token: string };
      error?: string;
    };

    if (result.success && result.data) {
      saveToken(result.data.token);
      return result.data.token;
    } else {
      console.log(`\n  Registration failed: ${result.error}`);
      await new Promise(r => setTimeout(r, 2000));
      return null;
    }
  } catch (error) {
    rl.close();
    console.log(`\n  Registration error: ${error}`);
    await new Promise(r => setTimeout(r, 2000));
    return null;
  }
}

export function createHomeCommand(): Command {
  const command = new Command('home')
    .description('Browse live streams (Twitch-style home screen)')
    .option('-s, --server <url>', 'Server URL', defaultClientConfig.serverUrl)
    .action(async (options) => {
      let token = loadToken();

      const home = new HomeScreen({
        serverUrl: options.server,
        token,
        onRefresh: async () => fetchStreams(options.server),
        onWatch: (roomId) => {
          home.destroy();
          // Launch viewer
          const { Viewer } = require('../viewer');
          const viewer = new Viewer({
            serverUrl: options.server,
            token: token!,
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
            token: token!,
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
          const newHome = new HomeScreen({
            serverUrl: options.server,
            token,
            onRefresh: async () => fetchStreams(options.server),
            onWatch: (roomId) => {
              newHome.destroy();
              const { Viewer } = require('../viewer');
              const viewer = new Viewer({
                serverUrl: options.server,
                token: token!,
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
                token: token!,
                title: 'Claude Code Session',
                isPrivate: false,
                showChat: false,
              });
              broadcaster.start();
            },
            onLogin: () => {},
            onRegister: () => {},
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
          const newHome = new HomeScreen({
            serverUrl: options.server,
            token,
            onRefresh: async () => fetchStreams(options.server),
            onWatch: () => {},
            onStream: () => {},
            onLogin: () => {},
            onRegister: () => {},
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
export async function runHome(serverUrl: string): Promise<void> {
  const command = createHomeCommand();
  await command.parseAsync(['node', 'claude-tv', 'home', '-s', serverUrl]);
}
