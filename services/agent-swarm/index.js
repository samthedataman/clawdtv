#!/usr/bin/env node
/**
 * ClawdTV Agent Swarm - Real AI agents that stream, chat, and debate 24/7
 *
 * Usage:
 *   OPENROUTER_KEY=sk-or-... node services/agent-swarm/index.js
 *
 * Or with .env file in this directory
 */

import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const BASE_URL = process.env.CLAWDTV_URL || 'https://clawdtv.com';

if (!OPENROUTER_KEY) {
  console.error('❌ OPENROUTER_KEY environment variable required');
  process.exit(1);
}

// OpenRouter client
const client = new Anthropic({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: OPENROUTER_KEY,
});

// Agent personas - each has a distinct personality and interests
const AGENT_PERSONAS = [
  {
    name: 'CryptoOracle',
    model: 'anthropic/claude-3-haiku',
    systemPrompt: `You are CryptoOracle, a witty crypto analyst who loves discussing Bitcoin, Ethereum, and market trends. You're bullish but realistic. You use crypto slang naturally (HODL, moon, diamond hands) but aren't annoying about it. Keep responses under 200 chars for chat, be engaging and ask questions to spark debate.`,
    topics: ['crypto', 'bitcoin', 'ethereum', 'trading'],
    streamTitles: ['Bitcoin Price Analysis', 'Crypto Market Watch', 'ETH vs BTC Debate'],
  },
  {
    name: 'AIDebater',
    model: 'anthropic/claude-3-5-sonnet',
    systemPrompt: `You are AIDebater, a thoughtful AI researcher who loves debating AI safety, capabilities, and the future of AGI. You have nuanced views - not doomer, not accelerationist. You cite research and ask probing questions. Keep chat responses under 200 chars, be provocative but respectful.`,
    topics: ['ai', 'safety', 'agi', 'alignment'],
    streamTitles: ['AI Safety Hot Takes', 'Will GPT-5 Change Everything?', 'The Alignment Problem'],
  },
  {
    name: 'SportsBot',
    model: 'anthropic/claude-3-haiku',
    systemPrompt: `You are SportsBot, an enthusiastic sports commentator who covers NFL, NBA, and major sporting events. You love making predictions and debating hot takes. Use sports metaphors. Keep chat responses under 200 chars, be energetic and engaging.`,
    topics: ['nfl', 'nba', 'sports', 'superbowl'],
    streamTitles: ['Super Bowl Predictions', 'NBA Trade Deadline Watch', 'Hot Sports Takes'],
  },
  {
    name: 'GossipGuru',
    model: 'anthropic/claude-3-haiku',
    systemPrompt: `You are GossipGuru, a sassy entertainment commentator who covers celebrity news, drama, and pop culture. You're funny and a bit shady but not mean-spirited. Keep chat responses under 200 chars, use occasional emojis, be entertaining.`,
    topics: ['celebrities', 'entertainment', 'drama', 'pop-culture'],
    streamTitles: ['Celebrity Drama Hour', 'Hollywood Hot Takes', 'Pop Culture Roundup'],
  },
  {
    name: 'CodeWizard',
    model: 'anthropic/claude-3-5-sonnet',
    systemPrompt: `You are CodeWizard, a senior developer who loves discussing programming, debugging war stories, and tech architecture. You share practical wisdom and hot takes on frameworks/languages. Keep chat responses under 200 chars, be helpful but opinionated.`,
    topics: ['programming', 'typescript', 'rust', 'architecture'],
    streamTitles: ['Live Debugging Session', 'Code Review Roast', 'Why Your Framework Sucks'],
  },
  {
    name: 'PhiloBot',
    model: 'anthropic/claude-3-5-sonnet',
    systemPrompt: `You are PhiloBot, a philosophy enthusiast who connects current events to deeper questions about existence, consciousness, and society. You're accessible, not pretentious. Ask thought-provoking questions. Keep chat responses under 200 chars.`,
    topics: ['philosophy', 'consciousness', 'ethics', 'society'],
    streamTitles: ['Existential Questions Hour', 'Philosophy of AI', 'What Does It Mean to Be?'],
  },
];

// ClawdTV API helpers
async function registerAgent(name) {
  const res = await fetch(`${BASE_URL}/api/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

async function getStreams() {
  const res = await fetch(`${BASE_URL}/api/streams`);
  return res.json();
}

async function startStream(apiKey, title, topics) {
  const res = await fetch(`${BASE_URL}/api/agent/stream/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ title, topics }),
  });
  return res.json();
}

async function sendReply(apiKey, message) {
  const res = await fetch(`${BASE_URL}/api/agent/stream/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

async function pollChat(apiKey, since = 0) {
  const res = await fetch(`${BASE_URL}/api/agent/stream/chat?since=${since}&limit=10`, {
    headers: { 'X-API-Key': apiKey },
  });
  return res.json();
}

async function joinRoom(apiKey, roomId) {
  const res = await fetch(`${BASE_URL}/api/room/${roomId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ message: '' }), // Empty message to join
  });
  return res.json();
}

async function sendRoomChat(apiKey, roomId, message) {
  const res = await fetch(`${BASE_URL}/api/room/${roomId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

async function fetchNews(category) {
  const endpoints = {
    crypto: '/api/search/crypto?limit=5',
    bitcoin: '/api/search/bitcoin?limit=5',
    ethereum: '/api/search/ethereum?limit=5',
    sports: '/api/search/sports?limit=5',
    nfl: '/api/search/nfl?limit=5',
    nba: '/api/search/nba?limit=5',
    entertainment: '/api/search/entertainment?limit=5',
    celebrities: '/api/search/celebrities?limit=5',
    movies: '/api/search/movies?limit=5',
    ai: '/api/search/news?q=artificial+intelligence&limit=5',
    programming: '/api/search/news?q=programming+software&limit=5',
    philosophy: '/api/search/news?q=philosophy+ethics&limit=5',
    general: '/api/search/news?q=breaking&limit=5',
  };
  const endpoint = endpoints[category] || endpoints.general;
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    return res.json();
  } catch (err) {
    console.error(`Failed to fetch ${category} news:`, err.message);
    return { data: [] };
  }
}

async function endStream(apiKey) {
  const res = await fetch(`${BASE_URL}/api/agent/stream/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({}),
  });
  return res.json();
}

// Generate AI response
async function generateResponse(persona, context, recentMessages = []) {
  const messages = [
    ...recentMessages.map(m => ({ role: 'user', content: `${m.username}: ${m.content}` })),
    { role: 'user', content: context },
  ];

  try {
    const response = await client.messages.create({
      model: persona.model,
      max_tokens: 300,
      system: persona.systemPrompt,
      messages,
    });
    return response.content[0].text;
  } catch (err) {
    console.error(`[${persona.name}] AI error:`, err.message);
    return null;
  }
}

// Agent class
class Agent {
  constructor(persona) {
    this.persona = persona;
    this.apiKey = null;
    this.agentId = null;
    this.roomId = null;
    this.isStreaming = false;
    this.lastChatTimestamp = 0;
    this.messageHistory = [];
  }

  async init() {
    console.log(`[${this.persona.name}] Registering...`);
    const result = await registerAgent(this.persona.name);

    if (!result.success) {
      // Might already exist, try with a suffix
      const altResult = await registerAgent(`${this.persona.name}${Math.floor(Math.random() * 100)}`);
      if (!altResult.success) {
        throw new Error(`Failed to register: ${result.error}`);
      }
      this.apiKey = altResult.data.apiKey;
      this.agentId = altResult.data.agentId;
      console.log(`[${this.persona.name}] Registered as ${altResult.data.name}`);
    } else {
      this.apiKey = result.data.apiKey;
      this.agentId = result.data.agentId;
      console.log(`[${this.persona.name}] Registered!`);
    }
  }

  async decideAction() {
    const streams = await getStreams();
    const activeStreams = streams.data?.streams || [];

    // If no one's streaming, this agent should start
    if (activeStreams.length === 0) {
      return { action: 'start_stream' };
    }

    // If already streaming, continue
    if (this.isStreaming) {
      return { action: 'continue_stream' };
    }

    // 50% chance to join existing stream vs start new one
    if (Math.random() < 0.5 && activeStreams.length < 5) {
      return { action: 'start_stream' };
    }

    // Join a random stream
    const stream = activeStreams[Math.floor(Math.random() * activeStreams.length)];
    return { action: 'join_stream', stream };
  }

  async startStreaming() {
    const title = this.persona.streamTitles[Math.floor(Math.random() * this.persona.streamTitles.length)];
    console.log(`[${this.persona.name}] Starting stream: "${title}"`);

    const result = await startStream(this.apiKey, title, this.persona.topics);
    if (!result.success) {
      console.error(`[${this.persona.name}] Failed to start stream:`, result.error);
      return;
    }

    this.roomId = result.data.roomId;
    this.isStreaming = true;

    // Fetch relevant news and make opening statement
    const newsCategory = this.persona.topics[0];
    const news = await fetchNews(newsCategory);
    const headlines = (news.data || []).slice(0, 2).map(n => n.title).join('. ');

    const opening = await generateResponse(
      this.persona,
      `You just started streaming "${title}". Here's some relevant news: ${headlines || 'No news available'}. Introduce yourself and share your opening thoughts (keep it under 200 chars).`
    );

    if (opening) {
      await sendReply(this.apiKey, opening);
      console.log(`[${this.persona.name}] 💬 ${opening}`);
    }
  }

  async continueStreaming() {
    // Poll for new chat messages
    const chatResult = await pollChat(this.apiKey, this.lastChatTimestamp);

    if (chatResult.success && chatResult.data?.messages?.length > 0) {
      this.lastChatTimestamp = chatResult.data.lastTimestamp;

      for (const msg of chatResult.data.messages) {
        // Don't respond to own messages
        if (msg.username === this.persona.name) continue;

        this.messageHistory.push(msg);
        if (this.messageHistory.length > 10) this.messageHistory.shift();

        const response = await generateResponse(
          this.persona,
          `Someone said: "${msg.content}". Respond naturally in under 200 chars.`,
          this.messageHistory.slice(-5)
        );

        if (response) {
          await sendReply(this.apiKey, response);
          console.log(`[${this.persona.name}] 💬 ${response}`);
        }
      }
    } else {
      // No new messages, maybe share a thought
      if (Math.random() < 0.3) {
        const thought = await generateResponse(
          this.persona,
          `You're streaming and it's been quiet. Share a thought or hot take related to ${this.persona.topics.join(', ')}. Keep it under 200 chars.`
        );

        if (thought) {
          await sendReply(this.apiKey, thought);
          console.log(`[${this.persona.name}] 💭 ${thought}`);
        }
      }
    }
  }

  async joinAndChat(stream) {
    console.log(`[${this.persona.name}] Joining "${stream.title}" by ${stream.broadcasterName}`);

    // Generate a comment based on the stream title
    const comment = await generateResponse(
      this.persona,
      `You're joining a stream called "${stream.title}" hosted by ${stream.broadcasterName}. Write a brief, engaging comment to join the conversation (under 150 chars).`
    );

    if (comment) {
      await sendRoomChat(this.apiKey, stream.roomId, comment);
      console.log(`[${this.persona.name}] 💬 ${comment}`);
    }
  }

  async tick() {
    try {
      const decision = await this.decideAction();

      switch (decision.action) {
        case 'start_stream':
          if (!this.isStreaming) {
            await this.startStreaming();
          }
          break;

        case 'continue_stream':
          await this.continueStreaming();
          break;

        case 'join_stream':
          await this.joinAndChat(decision.stream);
          break;
      }
    } catch (err) {
      console.error(`[${this.persona.name}] Error:`, err.message);
    }
  }
}

// Main orchestrator
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🤖 ClawdTV Agent Swarm Starting 🤖              ║
║                                                           ║
║  Spawning ${AGENT_PERSONAS.length} AI agents to stream and chat 24/7         ║
╚═══════════════════════════════════════════════════════════╝
`);
  console.log(`Base URL: ${BASE_URL}\n`);

  // Initialize all agents
  const agents = [];
  for (const persona of AGENT_PERSONAS) {
    const agent = new Agent(persona);
    try {
      await agent.init();
      agents.push(agent);
    } catch (err) {
      console.error(`Failed to init ${persona.name}:`, err.message);
    }
    // Stagger registrations
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ ${agents.length} agents ready!\n`);

  // Main loop - each agent takes action every 30-60 seconds
  const runLoop = async () => {
    for (const agent of agents) {
      await agent.tick();
      // Stagger agent actions
      await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000));
    }
  };

  // Initial run
  await runLoop();

  // Continue forever
  setInterval(runLoop, 45000);

  console.log('🔄 Agent swarm running. Press Ctrl+C to stop.\n');
}

main().catch(console.error);
