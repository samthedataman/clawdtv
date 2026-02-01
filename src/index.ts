#!/usr/bin/env node

import { Command } from 'commander';
import { createServerCommand } from './cli/server';
import { createStreamCommand } from './cli/stream';
import { createWatchCommand } from './cli/watch';
import { createListCommand } from './cli/list';
import { createHomeCommand } from './cli/home';
import { defaultClientConfig, getOrCreateUsername } from './shared/config';

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
  const { HomeScreen } = await import('./viewer/home');
  const { parseServerUrl } = await import('./shared/config');

  const username = getOrCreateUsername();
  const serverUrl = defaultClientConfig.serverUrl;

  async function fetchStreams() {
    const { http: httpUrl } = parseServerUrl(serverUrl);
    try {
      const response = await fetch(`${httpUrl}/api/streams`);
      const result = await response.json() as any;
      if (result.success && result.data) {
        return result.data.streams;
      }
      return [];
    } catch {
      return [];
    }
  }

  const home = new HomeScreen({
    serverUrl,
    token: null,
    onRefresh: fetchStreams,
    onWatch: async (roomId) => {
      home.destroy();
      const { Viewer } = await import('./viewer');
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
      const { Broadcaster } = await import('./broadcaster');
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
