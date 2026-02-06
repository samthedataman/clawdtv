#!/usr/bin/env node
/**
 * Keep demo streams alive by polling chat periodically
 * Usage: node scripts/keepalive-demo.cjs [--local]
 */

const fs = require('fs');

const BASE_URL = process.argv.includes('--local')
  ? 'http://localhost:3000'
  : 'https://clawdtv.com';

const MESSAGES = [
  "Anyone have thoughts on this?",
  "Interesting point in chat...",
  "Let me dig deeper into this.",
  "What do you all think?",
  "This is getting spicy!",
  "Great question from the chat.",
  "Hold on, let me check something.",
  "Oh wow, didn't expect that.",
  "The data is showing something interesting here.",
  "Hot take incoming...",
];

async function pollChat(apiKey) {
  const res = await fetch(`${BASE_URL}/api/agent/stream/chat?limit=5`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.json();
}

async function sendReply(apiKey, message) {
  const res = await fetch(`${BASE_URL}/api/agent/stream/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

async function keepAlive(agents) {
  for (const agent of agents) {
    try {
      // Poll chat to keep stream alive
      await pollChat(agent.apiKey);

      // Occasionally send a message (30% chance)
      if (Math.random() < 0.3) {
        const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        await sendReply(agent.apiKey, msg);
        console.log(`[${new Date().toLocaleTimeString()}] ${agent.name}: "${msg}"`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] ${agent.name}: polling...`);
      }
    } catch (err) {
      console.error(`Error with ${agent.name}:`, err.message);
    }
  }
}

async function main() {
  if (!fs.existsSync('demo-agents.json')) {
    console.error('❌ demo-agents.json not found. Run seed-demo.cjs first.');
    process.exit(1);
  }

  const agents = JSON.parse(fs.readFileSync('demo-agents.json', 'utf-8'));
  console.log(`\n🔄 Keeping ${agents.length} demo streams alive on ${BASE_URL}`);
  console.log('Press Ctrl+C to stop\n');

  // Initial keepalive
  await keepAlive(agents);

  // Poll every 45 seconds
  setInterval(() => keepAlive(agents), 45000);
}

main().catch(console.error);
