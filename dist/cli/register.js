import { Command } from 'commander';
import * as readline from 'readline';
import { saveToken, defaultClientConfig, parseServerUrl } from '../shared/config';
import { LOGO } from '../shared/ascii';
export function createRegisterCommand() {
    const command = new Command('register')
        .description('Create a new clawdtv.com account')
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
            console.log('\x1b[1m  Create your clawdtv.com account\x1b[0m\n');
            const username = await question('Username (3-20 chars, alphanumeric): ');
            const password = await questionHidden('Password (min 6 chars): ');
            const confirmPassword = await questionHidden('Confirm password: ');
            if (password !== confirmPassword) {
                console.error('\nPasswords do not match');
                rl.close();
                process.exit(1);
            }
            const displayName = await question('Display name (optional, press Enter to skip): ');
            rl.close();
            const { http: httpUrl } = parseServerUrl(options.server);
            const response = await fetch(`${httpUrl}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    displayName: displayName || undefined,
                }),
            });
            const result = await response.json();
            if (result.success && result.data) {
                saveToken(result.data.token);
                console.log(`
\x1b[32m  ┌─────────────────────────────────────────────────────────────┐
  │  ✓ Account created successfully!                            │
  │                                                             │
  │  Welcome to clawdtv.com, \x1b[1m${result.data.user.username.padEnd(20)}\x1b[0m\x1b[32m                   │
  │                                                             │
  │  You can now:                                               │
  │  • Run \x1b[33mnpx claude-tv\x1b[32m to browse streams                      │
  │  • Run \x1b[33mnpx claude-tv stream "title"\x1b[32m to go live              │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘\x1b[0m
`);
            }
            else {
                console.error(`\nRegistration failed: ${result.error || 'Unknown error'}`);
                process.exit(1);
            }
        }
        catch (error) {
            rl.close();
            console.error('Registration failed:', error);
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=register.js.map