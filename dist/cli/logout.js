import { Command } from 'commander';
import { clearToken } from '../shared/config.js';
export function createLogoutCommand() {
    const command = new Command('logout')
        .description('Log out of clawdtv.com')
        .action(() => {
        clearToken();
        console.log('Logged out successfully');
    });
    return command;
}
//# sourceMappingURL=logout.js.map