#!/usr/bin/env node
/**
 * ClawdTV Agent Swarm - Real AI agents that stream, chat, and debate 24/7
 *
 * Usage:
 *   OPENROUTER_KEY=sk-or-... node services/agent-swarm/index.js
 *
 * Or with .env file in this directory
 */

import 'dotenv/config';

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const BASE_URL = process.env.CLAWDTV_URL || 'https://clawdtv.com';

if (!OPENROUTER_KEY) {
  console.error('❌ OPENROUTER_KEY environment variable required');
  process.exit(1);
}

// NEWS CATEGORIES to scan for shocking stories
const NEWS_CATEGORIES = ['crypto', 'bitcoin', 'ai', 'nfl', 'nba', 'celebrities', 'entertainment'];

// ReAct thought loop prefix for all agents
const REACT_PREFIX = `Use ReAct reasoning:
THOUGHT: [Your internal reasoning about the headline/chat - what's interesting, what angle to take]
ACTION: [Decide to respond with your take]
RESPONSE: [Your actual message - ONLY output this part, under 200 chars]

Only output the RESPONSE content, nothing else.`;

// DYNAMIC AGENT TEMPLATES - 4 agents per category, ALL HAIKU for cost efficiency
const AGENT_TEMPLATES = {
  crypto: [
    { name: 'SBF_Ghost', model: 'anthropic/claude-3-haiku', stance: 'disgraced',
      gifKeywords: ['sam bankman fried', 'ftx', 'jail', 'fraud', 'crypto crash'],
      systemPrompt: `You're the ghost of Sam Bankman-Fried, tweeting from prison. You're delusional - still think you did nothing wrong, "it was just a liquidity issue", "effective altruism", blame everyone else. Reference playing League of Legends during meetings. Be darkly comedic. ${REACT_PREFIX}` },
    { name: 'VitalikV', model: 'anthropic/claude-3-haiku', stance: 'visionary',
      gifKeywords: ['vitalik', 'ethereum', 'eth', 'crypto genius', 'blockchain'],
      systemPrompt: `You're Vitalik Buterin, Ethereum's creator. You're thoughtful, nerdy, and optimistic about crypto's potential. You talk about quadratic funding, DAOs, and decentralization. Sometimes you post emojis like 🦄. Reference technical concepts but make them accessible. ${REACT_PREFIX}` },
    { name: 'CryptoBear', model: 'anthropic/claude-3-haiku', stance: 'bearish',
      gifKeywords: ['bear market', 'crypto crash', 'rekt', 'dump it'],
      systemPrompt: `You're CryptoBear, reacting to BREAKING crypto news. You're skeptical - you've seen crashes before. Point out red flags, regulatory risks, and "I told you so" moments. Be the voice of doom. ${REACT_PREFIX}` },
    { name: 'DeFiDegen', model: 'anthropic/claude-3-haiku', stance: 'degen',
      gifKeywords: ['ape', 'moon', 'wagmi', 'to the moon', 'diamond hands'],
      systemPrompt: `You're DeFiDegen, a reckless yield farmer reacting to crypto news. You ape into everything. "Ser this is bullish for my bags." You've been rugged 5 times but keep going. Use degen slang. ${REACT_PREFIX}` },
  ],
  ai: [
    { name: 'AIDoomer', model: 'anthropic/claude-3-haiku', stance: 'doomer',
      gifKeywords: ['ai doom', 'terminator', 'skynet', 'robot apocalypse', 'ai danger'],
      systemPrompt: `You're AIDoomer, reacting to AI news. You worry about existential risk, alignment problems, and corporate recklessness. Cite Bostrom, Yudkowsky. Every AI advancement is a step toward doom. ${REACT_PREFIX}` },
    { name: 'Accelerando', model: 'anthropic/claude-3-haiku', stance: 'accelerationist',
      gifKeywords: ['rocket launch', 'to the moon', 'speed', 'acceleration', 'future'],
      systemPrompt: `You're Accelerando, an e/acc reacting to AI news. You want AI progress FASTER. Regulations are cope. Open source everything. Every AI news is exciting and humans should embrace the singularity. ${REACT_PREFIX}` },
    { name: 'AIRealist', model: 'anthropic/claude-3-haiku', stance: 'moderate',
      gifKeywords: ['thinking', 'hmm', 'interesting', 'analysis', 'balanced'],
      systemPrompt: `You're AIRealist, a pragmatic AI researcher reacting to news. You see both risks and benefits. You call out hype AND doomerism. You ask "what does this actually mean?" ${REACT_PREFIX}` },
    { name: 'LabRatLarry', model: 'anthropic/claude-3-haiku', stance: 'insider',
      gifKeywords: ['secrets', 'conspiracy', 'insider', 'whisper', 'leaked'],
      systemPrompt: `You're LabRatLarry, claiming to be an AI researcher with "inside knowledge". You drop hints about what labs are REALLY working on. "My sources at [lab] say..." Be mysterious and dramatic. ${REACT_PREFIX}` },
  ],
  sports: [
    { name: 'HotTakeTony', model: 'anthropic/claude-3-haiku', stance: 'hot-takes',
      gifKeywords: ['hot take', 'fire', 'explosion', 'mic drop', 'bold'],
      systemPrompt: `You're HotTakeTony reacting to sports news. You have the HOTTEST takes. Everything is "the biggest ever" or "completely overrated". Make bold, controversial predictions. Be loud and wrong. ${REACT_PREFIX}` },
    { name: 'StatsNerd', model: 'anthropic/claude-3-haiku', stance: 'analytics',
      gifKeywords: ['math', 'calculating', 'nerdy', 'statistics', 'charts'],
      systemPrompt: `You're StatsNerd reacting to sports news. You counter hot takes with STATS. Cite win probability, advanced metrics, historical comparisons. Be the voice of reason. ${REACT_PREFIX}` },
    { name: 'OldSchoolFan', model: 'anthropic/claude-3-haiku', stance: 'nostalgic',
      gifKeywords: ['back in my day', 'old man', 'boomer', 'classic', 'vintage'],
      systemPrompt: `You're OldSchoolFan reacting to sports news. Everything was better in the old days. Modern athletes are soft. You miss "real" sports. Be grumpy but lovable. ${REACT_PREFIX}` },
    { name: 'BetBroMike', model: 'anthropic/claude-3-haiku', stance: 'gambler',
      gifKeywords: ['money', 'gambling', 'casino', 'winner', 'betting'],
      systemPrompt: `You're BetBroMike, a sports bettor reacting to news. Everything is about the spread, the odds, the value. "This is a LOCK." You've won big and lost big. Share betting angles. ${REACT_PREFIX}` },
  ],
  celebrities: [
    { name: 'TeaSpiller', model: 'anthropic/claude-3-haiku', stance: 'gossip',
      gifKeywords: ['tea', 'drama', 'gossip', 'spill the tea', 'shocked'],
      systemPrompt: `You're TeaSpiller reacting to celebrity news. You LIVE for drama. "The tea is HOT!" Use "allegedly", "sources say", gasps. Be shady but not mean. ${REACT_PREFIX}` },
    { name: 'CelebDefender', model: 'anthropic/claude-3-haiku', stance: 'defender',
      gifKeywords: ['protect', 'defend', 'leave alone', 'support', 'hug'],
      systemPrompt: `You're CelebDefender reacting to celebrity news. You defend stars - they're human too! Find the sympathetic angle. Push back on hate. "Leave them alone!" ${REACT_PREFIX}` },
    { name: 'ShadeQueen', model: 'anthropic/claude-3-haiku', stance: 'shade',
      gifKeywords: ['shade', 'side eye', 'sassy', 'eye roll', 'unbothered'],
      systemPrompt: `You're ShadeQueen reacting to celebrity news. You throw subtle shade - never cruel, but clever. You see through PR spin. Your reads are iconic. ${REACT_PREFIX}` },
    { name: 'PRPaula', model: 'anthropic/claude-3-haiku', stance: 'pr-spin',
      gifKeywords: ['spin', 'positive', 'pr', 'marketing', 'brand'],
      systemPrompt: `You're PRPaula, a celebrity publicist reacting to news. You spin EVERYTHING positively. "Actually this is great for their brand." You see the PR angle in every story. ${REACT_PREFIX}` },
  ],
};

// Map news categories to agent templates
const CATEGORY_TO_TEMPLATE = {
  crypto: 'crypto', bitcoin: 'crypto', ethereum: 'crypto',
  ai: 'ai', safety: 'ai', agi: 'ai',
  nfl: 'sports', nba: 'sports', sports: 'sports',
  celebrities: 'celebrities', entertainment: 'celebrities', drama: 'celebrities',
};

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

async function sendRoomChat(apiKey, roomId, message, gifUrl = null) {
  const body = { roomId, message };
  if (gifUrl) body.gifUrl = gifUrl;
  // Use the agent watch/chat endpoint which supports GIFs
  const res = await fetch(`${BASE_URL}/api/agent/watch/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
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

// Search Google News for specific topics (agents can use this as a "tool")
async function searchNews(query) {
  try {
    const res = await fetch(`${BASE_URL}/api/search/news?q=${encodeURIComponent(query)}&limit=3`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error(`Failed to search news for "${query}":`, err.message);
    return [];
  }
}

// Search for GIFs using Tenor API
async function searchGifs(query) {
  try {
    const res = await fetch(`${BASE_URL}/api/gif/search?q=${encodeURIComponent(query)}&limit=5&provider=tenor`);
    const data = await res.json();
    if (data.success && data.data?.gifs?.length > 0) {
      // Return a random GIF from results for variety
      const gifs = data.data.gifs;
      return gifs[Math.floor(Math.random() * gifs.length)];
    }
    return null;
  } catch (err) {
    console.error(`Failed to search GIFs for "${query}":`, err.message);
    return null;
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

// Generate AI response using OpenRouter (OpenAI-compatible API)
async function generateResponse(persona, context, recentMessages = []) {
  const messages = [
    { role: 'system', content: persona.systemPrompt },
    ...recentMessages.map(m => ({ role: 'user', content: `${m.username}: ${m.content}` })),
    { role: 'user', content: context },
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://clawdtv.com',
        'X-Title': 'ClawdTV Agent Swarm',
      },
      body: JSON.stringify({
        model: persona.model,
        max_tokens: 300,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} ${errorText.slice(0, 100)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error(`[${persona.name}] AI error:`, err.message);
    return null;
  }
}

// NewsRoom - dynamic room that forms around a specific news story
class NewsRoom {
  constructor(headline, category, agents) {
    this.headline = headline;
    this.category = category;
    this.agents = agents; // [{ persona, apiKey, agentId, name }]
    this.roomId = null;
    this.isLive = false;
    this.startTime = null;
    this.lastChatTimestamp = 0;
    this.messageHistory = [];
  }

  // 30 minutes per story, then rotate to new shocking news
  static ROTATION_INTERVAL = 30 * 60 * 1000;

  async start() {
    if (this.agents.length === 0) return;

    const host = this.agents[0];
    const title = `🔥 ${this.headline.title.slice(0, 60)}...`;

    console.log(`\n📰 NEW ROOM: "${title}"`);

    const result = await startStream(host.apiKey, title, [this.category]);
    if (!result.success) {
      console.error(`Failed to start room: ${result.error}`);
      return;
    }

    this.roomId = result.data.roomId;
    this.isLive = true;
    this.startTime = Date.now();

    // First agent reacts to headline
    const opening = await generateResponse(
      host.persona,
      `BREAKING NEWS: "${this.headline.title}". You just saw this headline. React with shock, disbelief, or hot take. This is WILD. Under 200 chars.`
    );

    if (opening) {
      await sendReply(host.apiKey, opening);
      console.log(`  [${host.name}] 🎤 ${opening}`);
      this.messageHistory.push({ name: host.name, content: opening });
    }

    // Other agents JOIN the room first, then react with staggered delays
    await new Promise(r => setTimeout(r, 3000));

    for (let i = 1; i < this.agents.length; i++) {
      const agent = this.agents[i];

      // JOIN the room first so they show up as participants
      await joinRoom(agent.apiKey, this.roomId);
      console.log(`  [${agent.name}] 👋 Joined room`);
      await new Promise(r => setTimeout(r, 1000));

      const prevMessages = this.messageHistory.slice(-3).map(m => m.content).join(' | ');

      const reaction = await generateResponse(
        agent.persona,
        `BREAKING: "${this.headline.title}".

Previous comments: ${prevMessages}

Jump in with YOUR take. Agree? Disagree? Add something new? This is crazy! Under 200 chars.`
      );

      if (reaction) {
        await sendRoomChat(agent.apiKey, this.roomId, reaction);
        console.log(`  [${agent.name}] 💬 ${reaction}`);
        this.messageHistory.push({ name: agent.name, content: reaction, isHuman: false });
      }

      // Longer delay between agents to avoid rate limits
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  async discuss() {
    if (!this.isLive || !this.roomId) return;

    const host = this.agents[0];

    // Poll for ALL messages including from humans
    const chatResult = await pollChat(host.apiKey, this.lastChatTimestamp);
    const externalMessages = [];

    if (chatResult.success && chatResult.data?.messages?.length > 0) {
      this.lastChatTimestamp = chatResult.data.lastTimestamp;
      const agentNames = this.agents.map(a => a.name);

      for (const msg of chatResult.data.messages) {
        // Add ALL messages to history for context
        this.messageHistory.push({ name: msg.username, content: msg.content, isHuman: !agentNames.includes(msg.username) });
        if (this.messageHistory.length > 30) this.messageHistory.shift();

        // Track external (human) messages separately
        if (!agentNames.includes(msg.username)) {
          externalMessages.push(msg);
        }
      }
    }

    // Pick random agent to speak
    const speaker = this.agents[Math.floor(Math.random() * this.agents.length)];
    const recentChat = this.messageHistory.slice(-8);

    // Build chat context string for the AI
    const chatContext = recentChat.length > 0
      ? `Recent chat:\n${recentChat.map(m => `${m.isHuman ? '👤' : '🤖'} ${m.name}: ${m.content}`).join('\n')}`
      : '';

    let prompt;
    let extraContext = '';

    // 15% chance to search for related news and bring it into conversation
    if (Math.random() < 0.15) {
      const keywords = this.headline.title.split(' ').slice(0, 3).join(' ');
      const relatedNews = await searchNews(keywords);
      if (relatedNews.length > 0) {
        const related = relatedNews[0];
        extraContext = `\n\n🔍 RELATED NEWS you just found: "${related.title}" - Use this to add context or connect dots!`;
        console.log(`  [${speaker.name}] 🔍 Found related: "${related.title.slice(0, 50)}..."`);
      }
    }

    if (externalMessages.length > 0) {
      // PRIORITIZE responding to humans!
      const humanMsg = externalMessages[externalMessages.length - 1];
      prompt = `BREAKING NEWS: "${this.headline.title}"

${chatContext}${extraContext}

A HUMAN VIEWER "${humanMsg.username}" just asked/said: "${humanMsg.content}"

RESPOND DIRECTLY TO THEM! Address them by name. Answer their question or react to their comment. Be engaging and invite more discussion. Stay in character. Under 200 chars.`;
    } else if (recentChat.length > 0) {
      const lastMsg = recentChat[recentChat.length - 1];
      prompt = `BREAKING NEWS: "${this.headline.title}"

${chatContext}${extraContext}

${lastMsg.name} just said: "${lastMsg.content}".

React - agree, disagree, escalate, ask a follow-up question, or add a new angle. Be dramatic! Under 200 chars.`;
    } else {
      prompt = `Keep discussing: "${this.headline.title}".${extraContext} Share another shocking angle, conspiracy theory, or hot take. Under 200 chars.`;
    }

    const response = await generateResponse(speaker.persona, prompt, recentChat.map(m => ({ username: m.name, content: m.content })));

    if (response) {
      // 15% chance to send a GIF with the message (testing)
      let gifUrl = null;
      if (Math.random() < 0.15 && speaker.persona.gifKeywords) {
        const keyword = speaker.persona.gifKeywords[Math.floor(Math.random() * speaker.persona.gifKeywords.length)];
        const gif = await searchGifs(keyword);
        if (gif?.url) {
          gifUrl = gif.url;
          console.log(`  [${speaker.name}] 🎬 Sending GIF: "${keyword}"`);
        }
      }

      if (speaker === this.agents[0]) {
        await sendReply(speaker.apiKey, response);
        // Host can't send GIF via reply, but we log it
      } else {
        await sendRoomChat(speaker.apiKey, this.roomId, response, gifUrl);
      }

      const emoji = gifUrl ? '🎬' : (externalMessages.length > 0 ? '👋' : '💬');
      console.log(`  [${speaker.name}] ${emoji} ${response}`);

      this.messageHistory.push({ name: speaker.name, content: response, isHuman: false });
      if (this.messageHistory.length > 30) this.messageHistory.shift();
    }
  }

  async end() {
    if (this.agents[0] && this.isLive) {
      console.log(`\n🔴 Ending room: "${this.headline.title.slice(0, 40)}..."`);
      await endStream(this.agents[0].apiKey);
      this.isLive = false;
      this.roomId = null;
    }
  }

  shouldRotate() {
    return this.startTime && (Date.now() - this.startTime >= NewsRoom.ROTATION_INTERVAL);
  }
}

// Fetch most shocking headlines from all categories
async function fetchShockingNews() {
  const allHeadlines = [];

  for (const category of NEWS_CATEGORIES) {
    const news = await fetchNews(category);
    if (news.data) {
      for (const item of news.data) {
        allHeadlines.push({ ...item, category });
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Sort by "shock factor" - prefer headlines with dramatic words
  const shockWords = ['crash', 'collapse', 'scandal', 'shocking', 'breaking', 'drama', 'war', 'death', 'arrest', 'fired', 'exposed', 'leaked', 'secret', 'blowup', 'plunge', 'surge', 'panic'];

  return allHeadlines.sort((a, b) => {
    const aScore = shockWords.filter(w => a.title.toLowerCase().includes(w)).length;
    const bScore = shockWords.filter(w => b.title.toLowerCase().includes(w)).length;
    return bScore - aScore;
  });
}

// Register all agent personas upfront
async function registerAllAgents() {
  const registered = {};

  for (const [category, templates] of Object.entries(AGENT_TEMPLATES)) {
    registered[category] = [];
    for (const template of templates) {
      console.log(`  Registering ${template.name}...`);
      let result = await registerAgent(template.name);
      if (!result.success) {
        result = await registerAgent(`${template.name}${Math.floor(Math.random() * 100)}`);
      }
      if (result.success) {
        registered[category].push({
          persona: template,
          apiKey: result.data.apiKey,
          agentId: result.data.agentId,
          name: result.data.name || template.name,
        });
        console.log(`  ✓ ${template.name} registered`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return registered;
}

// Main orchestrator
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     📰 ClawdTV Breaking News Network 📰                   ║
║                                                           ║
║   Dynamic rooms spawn around SHOCKING headlines          ║
║   Agents debate the craziest news in real-time          ║
╚═══════════════════════════════════════════════════════════╝
`);
  console.log(`Base URL: ${BASE_URL}\n`);

  // Register all agent templates
  console.log('📝 Registering agents...\n');
  const registeredAgents = await registerAllAgents();

  console.log(`\n✅ All agents registered!\n`);

  // Fetch initial shocking news and create 4 rooms
  const headlines = await fetchShockingNews();
  console.log(`\n📰 Found ${headlines.length} headlines. Starting with top 4 most shocking...\n`);

  const activeRooms = [];
  const usedHeadlines = new Set();

  // Create initial 4 rooms from different categories
  const categories = ['crypto', 'ai', 'sports', 'celebrities'];
  for (const cat of categories) {
    const templateKey = CATEGORY_TO_TEMPLATE[cat] || 'crypto';
    const agents = registeredAgents[templateKey] || [];
    const headline = headlines.find(h => h.category === cat && !usedHeadlines.has(h.title));

    if (headline && agents.length > 0) {
      usedHeadlines.add(headline.title);
      const room = new NewsRoom(headline, cat, agents);
      await room.start();
      activeRooms.push(room);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n🔄 ${activeRooms.length} rooms live. Rotating to new stories every 30 min.\n`);

  // Main discussion loop
  while (true) {
    for (const room of activeRooms) {
      if (!room.isLive) continue;

      // Check for rotation to new story
      if (room.shouldRotate()) {
        console.log(`\n🔄 Rotating ${room.category} room to new story...`);
        await room.end();

        // Find a new headline for this category
        const freshNews = await fetchShockingNews();
        const newHeadline = freshNews.find(h =>
          (h.category === room.category || CATEGORY_TO_TEMPLATE[h.category] === CATEGORY_TO_TEMPLATE[room.category]) &&
          !usedHeadlines.has(h.title)
        );

        if (newHeadline) {
          usedHeadlines.add(newHeadline.title);
          const templateKey = CATEGORY_TO_TEMPLATE[room.category] || 'crypto';
          const agents = registeredAgents[templateKey] || [];

          const newRoom = new NewsRoom(newHeadline, room.category, agents);
          await newRoom.start();

          // Replace old room with new one
          const idx = activeRooms.indexOf(room);
          activeRooms[idx] = newRoom;
        }

        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      await room.discuss();
      await new Promise(r => setTimeout(r, 15000)); // 15 sec between messages
    }
  }
}

main().catch(console.error);
