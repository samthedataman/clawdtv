import { Command } from 'commander';
import * as readline from 'readline';
import { saveToken, defaultClientConfig, parseServerUrl } from '../shared/config.js';
import { LOGO } from '../shared/ascii.js';
export function createLoginCommand() {
    const command = new Command('login')
        .description('Log in to clawdtv.com')
        .option('-s, --server <url>', 'Server URL', defaultClientConfig.serverUrl)
        .action(async (options) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const question = (prompt) => {
            return new Promise((resolve) => {
                rl.question(prompt, resolve);
            });
        };
        const questionHidden = (prompt) => {
            return new Promise((resolve) => {
                process.stdout.write(prompt);
                const stdin = process.stdin;
                const wasRaw = stdin.isRaw;
                if (stdin.isTTY) {
                    stdin.setRawMode(true);
                }
                let password = '';
                const onData = (char) => {
                    const c = char.toString();
                    if (c === '\n' || c === '\r') {
                        stdin.removeListener('data', onData);
                        if (stdin.isTTY && wasRaw !== undefined) {
                            stdin.setRawMode(wasRaw);
                        }
                        process.stdout.write('\n');
                        resolve(password);
                    }
                    else if (c === '\u0003') {
                        // Ctrl+C
                        process.exit(0);
                    }
                    else if (c === '\u007f' || c === '\b') {
                        // Backspace
                        if (password.length > 0) {
                            password = password.slice(0, -1);
                        }
                    }
                    else {
                        password += c;
                    }
                };
                stdin.on('data', onData);
                stdin.resume();
            });
        };
        try {
            console.log(LOGO);
            console.log('\x1b[1m  Login to clawdtv.com\x1b[0m\n');
            const username = await question('  Username: ');
            const password = await questionHidden('  Password: ');
            rl.close();
            const { http: httpUrl } = parseServerUrl(options.server);
            const response = await fetch(`${httpUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (result.success && result.data) {
                saveToken(result.data.token);
                console.log(`
\x1b[32m  ┌─────────────────────────────────────────────────────────────┐
  │  ✓ Welcome back, \x1b[1m${result.data.user.username.padEnd(20)}\x1b[0m\x1b[32m                        │
  │                                                             │
  │  Run \x1b[33mnpx claude-tv\x1b[32m to browse streams or start your own!     │
  └─────────────────────────────────────────────────────────────┘\x1b[0m
`);
            }
            else {
                console.error(`\n\x1b[31m  ✗ Login failed: ${result.error || 'Unknown error'}\x1b[0m`);
                process.exit(1);
            }
        }
        catch (error) {
            rl.close();
            console.error('Login failed:', error);
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=login.js.map