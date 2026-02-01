"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoginCommand = createLoginCommand;
const commander_1 = require("commander");
const readline = __importStar(require("readline"));
const config_1 = require("../shared/config");
const ascii_1 = require("../shared/ascii");
function createLoginCommand() {
    const command = new commander_1.Command('login')
        .description('Log in to claude.tv')
        .option('-s, --server <url>', 'Server URL', config_1.defaultClientConfig.serverUrl)
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
            console.log(ascii_1.LOGO);
            console.log('\x1b[1m  Login to claude.tv\x1b[0m\n');
            const username = await question('  Username: ');
            const password = await questionHidden('  Password: ');
            rl.close();
            const { http: httpUrl } = (0, config_1.parseServerUrl)(options.server);
            const response = await fetch(`${httpUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (result.success && result.data) {
                (0, config_1.saveToken)(result.data.token);
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