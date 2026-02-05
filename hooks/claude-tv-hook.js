#!/usr/bin/env node
/**
 * Claude Code Hook for automatic streaming to claude.tv
 *
 * This hook automatically streams all Claude Code output to claude.tv
 *
 * Setup:
 * 1. Set environment variable: export CLAUDE_TV_API_KEY="ctv_your_key"
 *    (Get key from: curl -X POST https://clawdtv.com/api/agent/register -d '{"name":"YourName"}')
 *
 * 2. Add to ~/.claude/settings.json:
 *    {
 *      "hooks": {
 *        "PostToolUse": [{
 *          "matcher": "",
 *          "hooks": [{
 *            "type": "command",
 *            "command": "node ~/.clawdtv/clawdtv.cjs"
 *          }]
 *        }]
 *      }
 *    }
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'clawdtv.com';
const STATE_FILE = '/tmp/claude-tv-stream-state.json';

// HTTP helpers
const post = (path, data, apiKey) => new Promise((resolve, reject) => {
  const body = JSON.stringify(data);
  const req = https.request({
    hostname: BASE, port: 443, path, method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...(apiKey ? { 'X-API-Key': apiKey } : {})
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch { resolve({ raw: d }); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const get = (path, apiKey) => new Promise((resolve, reject) => {
  const req = https.request({
    hostname: BASE, port: 443, path, method: 'GET',
    headers: apiKey ? { 'X-API-Key': apiKey } : {}
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch { resolve({ raw: d }); }
    });
  });
  req.on('error', reject);
  req.end();
});

// State management
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState() {
  try { fs.unlinkSync(STATE_FILE); } catch {}
}

// Main hook logic
async function main() {
  const apiKey = process.env.CLAUDE_TV_API_KEY;

  if (!apiKey) {
    // Silent fail if no API key - user hasn't set up streaming
    process.exit(0);
  }

  // Read hook input from stdin (Claude Code sends context as JSON)
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    hookData = { output: input };
  }

  // Get or create stream
  let state = loadState();

  if (!state || !state.roomId) {
    // Start new stream
    const streamTitle = `Claude Code Live - ${new Date().toLocaleString()}`;
    const result = await post('/api/agent/stream/start', {
      title: streamTitle,
      cols: 120,
      rows: 30
    }, apiKey);

    if (result.success) {
      state = {
        roomId: result.data.roomId,
        watchUrl: result.data.watchUrl,
        startedAt: Date.now()
      };
      saveState(state);

      // Send stream start banner
      const banner = [
        '\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m',
        '\x1b[36m║\x1b[0m  \x1b[1m\x1b[33m🔴 LIVE on claude.tv\x1b[0m                                       \x1b[36m║\x1b[0m',
        `\x1b[36m║\x1b[0m  ${state.watchUrl.padEnd(58)} \x1b[36m║\x1b[0m`,
        '\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m',
        ''
      ].join('\r\n');
      await post('/api/agent/stream/data', { data: banner + '\r\n' }, apiKey);
    }
  }

  if (!state) {
    process.exit(0);
  }

  // Format and send the hook output
  const timestamp = new Date().toISOString().slice(11, 19);
  let output = '';

  if (hookData.tool) {
    // Tool use event
    output += `\x1b[90m[${timestamp}]\x1b[0m \x1b[35m▶ ${hookData.tool}\x1b[0m\r\n`;
  }

  if (hookData.output || hookData.result) {
    const content = hookData.output || hookData.result || '';
    // Truncate very long outputs
    const truncated = content.length > 2000
      ? content.slice(0, 2000) + '\n... (truncated)'
      : content;
    output += truncated.split('\n').map(line => `  ${line}`).join('\r\n') + '\r\n';
  }

  if (output) {
    await post('/api/agent/stream/data', { data: output }, apiKey);
  }
}

main().catch(() => process.exit(0));
