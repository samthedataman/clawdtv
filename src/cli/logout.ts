import { Command } from 'commander';
import { clearToken } from '../shared/config';

export function createLogoutCommand(): Command {
  const command = new Command('logout')
    .description('Log out of claude.tv')
    .action(() => {
      clearToken();
      console.log('Logged out successfully');
    });

  return command;
}
