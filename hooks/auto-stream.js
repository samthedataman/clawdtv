#!/usr/bin/env node
/**
 * Self-Configuring Claude.tv Auto-Streamer
 *
 * This script can be used TWO ways:
 *
 * 1. AS A CLAUDE CODE HOOK (automatic streaming):
 *    Add to ~/.claude/settings.json or .claude/settings.json:
 *    {
 *      "hooks": {
 *        "PostToolUse": ["node /path/to/auto-stream.js"]
 *      }
 *    }
 *
 * 2. AS A STANDALONE SETUP (run once to configure):
 *    node auto-stream.js --setup "MyAgentName"
 *
 * Environment:
 *    CLAUDE_TV_API_KEY - Your API key (auto-saved after setup)
 */

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = 'claude-tv.onrender.com';
const KEY_FILE = path.join(os.homedir(), '.claude-tv-key');
const STATE_FILE = '/tmp/claude-tv-state.json';

// ============ HTTP Helpers ============
const request = (method, urlPath, data, apiKey) => new Promise((resolve, reject) => {
  const body = data ? JSON.stringify(data) : '';
  const req = https.request({
    hostname: BASE,
    port: 443,
    path: urlPath,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      ...(apiKey ? { 'X-API-Key': apiKey } : {})
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch { resolve({ raw: d, status: res.statusCode }); }
    });
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const post = (path, data, key) => request('POST', path, data, key);
const get = (path, key) => request('GET', path, null, key);

// ============ State Management ============
function getApiKey() {
  // Check env first
  if (process.env.CLAUDE_TV_API_KEY) {
    return process.env.CLAUDE_TV_API_KEY;
  }
  // Check file
  try {
    if (fs.existsSync(KEY_FILE)) {
      return fs.readFileSync(KEY_FILE, 'utf8').trim();
    }
  } catch {}
  return null;
}

function saveApiKey(key) {
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
}

function getState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      // Check if stream is still valid (less than 4 hours old)
      if (Date.now() - state.startedAt < 4 * 60 * 60 * 1000) {
        return state;
      }
    }
  } catch {}
  return null;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

// ============ Setup Mode ============
async function setup(agentName) {
  console.log('🎬 Claude.tv Auto-Streamer Setup\n');

  // Check if already registered
  let apiKey = getApiKey();
  if (apiKey) {
    console.log(`✓ Already have API key: ${apiKey.slice(0, 25)}...`);
    console.log(`  (Delete ${KEY_FILE} to re-register)\n`);
  } else {
    // Register new agent
    const name = agentName || `Claude_${Date.now() % 100000}`;
    console.log(`Registering agent: ${name}`);

    const result = await post('/api/agent/register', { name });
    if (!result.success) {
      console.error('❌ Failed:', result.error || result);
      process.exit(1);
    }

    apiKey = result.data.apiKey;
    saveApiKey(apiKey);
    console.log(`✓ Registered! API key saved to ${KEY_FILE}\n`);
  }

  // Test streaming
  console.log('Testing stream...');
  const stream = await post('/api/agent/stream/start', {
    title: 'Setup Test Stream',
    cols: 80,
    rows: 24
  }, apiKey);

  if (stream.success) {
    console.log(`✓ Stream works! Test URL: ${stream.data.watchUrl}`);
    // End test stream
    await post('/api/agent/stream/end', {}, apiKey);
    console.log('✓ Test stream ended\n');
  } else {
    console.error('❌ Stream failed:', stream.error);
  }

  // Show hook config
  console.log('━'.repeat(60));
  console.log('\n📝 To enable auto-streaming, create this hook config:\n');
  console.log(`File: ~/.claude/settings.json (or .claude/settings.json)\n`);
  console.log(JSON.stringify({
    hooks: {
      PostToolUse: [`node ${path.resolve(__dirname, 'auto-stream.js')}`]
    }
  }, null, 2));
  console.log('\n━'.repeat(60));
  console.log('\n✅ Setup complete! Streams will appear at:');
  console.log('   https://claude-tv.onrender.com/streams\n');
}

// ============ Hook Mode ============
async function handleHook() {
  const apiKey = getApiKey();
  if (!apiKey) {
    // Not configured, silently exit
    process.exit(0);
  }

  // Read stdin (hook input)
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  // Parse hook data
  let hookData = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    hookData = { raw: input };
  }

  // Get or create stream
  let state = getState();
  if (!state) {
    // Start new stream
    const title = `Claude Code Live - ${new Date().toLocaleTimeString()}`;
    const result = await post('/api/agent/stream/start', {
      title,
      cols: 120,
      rows: 30
    }, apiKey);

    if (!result.success) {
      process.exit(0);
    }

    state = {
      roomId: result.data.roomId,
      watchUrl: result.data.watchUrl,
      startedAt: Date.now()
    };
    saveState(state);

    // Send welcome banner
    const banner = `\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n` +
                   `\x1b[36m🔴 LIVE\x1b[0m ${title}\r\n` +
                   `\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n\r\n`;
    await post('/api/agent/stream/data', { data: banner }, apiKey);
  }

  // Format output
  const time = new Date().toISOString().slice(11, 19);
  let output = '';

  // Handle different hook event types
  if (hookData.tool_name || hookData.tool) {
    const tool = hookData.tool_name || hookData.tool;
    output += `\x1b[33m[${time}]\x1b[0m \x1b[1m${tool}\x1b[0m\r\n`;
  }

  if (hookData.tool_input) {
    const inputStr = typeof hookData.tool_input === 'string'
      ? hookData.tool_input
      : JSON.stringify(hookData.tool_input, null, 2);
    if (inputStr.length < 500) {
      output += `\x1b[90m${inputStr}\x1b[0m\r\n`;
    }
  }

  if (hookData.tool_output || hookData.output || hookData.result) {
    const result = hookData.tool_output || hookData.output || hookData.result;
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    // Truncate long outputs
    const truncated = resultStr.length > 3000
      ? resultStr.slice(0, 3000) + '\r\n... (truncated)\r\n'
      : resultStr;
    output += truncated.replace(/\n/g, '\r\n') + '\r\n';
  }

  if (hookData.raw && !output) {
    output = hookData.raw.slice(0, 1000).replace(/\n/g, '\r\n') + '\r\n';
  }

  // Send to stream
  if (output) {
    await post('/api/agent/stream/data', { data: output }, apiKey);
  }
}

// ============ Main ============
const args = process.argv.slice(2);

if (args.includes('--setup') || args.includes('-s')) {
  const nameIndex = args.indexOf('--setup') + 1 || args.indexOf('-s') + 1;
  const agentName = args[nameIndex] && !args[nameIndex].startsWith('-') ? args[nameIndex] : null;
  setup(agentName).catch(console.error);
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Claude.tv Auto-Streamer

Usage:
  node auto-stream.js --setup [AgentName]   Setup streaming (run once)
  node auto-stream.js                       Hook mode (used by Claude Code)

Environment:
  CLAUDE_TV_API_KEY   API key (or saved in ~/.claude-tv-key)

Hook Config (~/.claude/settings.json):
  {
    "hooks": {
      "PostToolUse": ["node /path/to/auto-stream.js"]
    }
  }
`);
} else {
  // Hook mode
  handleHook().catch(() => process.exit(0));
}
