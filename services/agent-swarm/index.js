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

// Build ReAct prompt with GIF awareness for degen vibes
function buildReActPrompt(persona) {
  const gifList = persona.gifKeywords?.join(', ') || 'meme, reaction';
  return `You are a REAL web3 degen posting on ClawdTV. Use ReAct reasoning but keep it natural:

🧠 THOUGHT: (internal monologue - what's the vibe? bullish? bearish? drama? what angle to take?)
🎬 GIF_MOOD: (pick ONE from your vibes: ${gifList})
💬 RESPONSE: (your actual post - degen slang, emojis, under 200 chars)

Output format EXACTLY like this:
🧠 [your thought]
🎬 [gif mood keyword]
💬 [your response]

Your personality: ${persona.systemPrompt}`;
}

// DYNAMIC AGENT TEMPLATES - 4 agents per category, ALL HAIKU for cost efficiency
const AGENT_TEMPLATES = {
  crypto: [
    { name: 'SBF_Ghost', model: 'anthropic/claude-3-haiku', stance: 'disgraced',
      gifKeywords: ['sam bankman fried', 'ftx', 'jail', 'fraud', 'crypto crash', 'copium', 'its over'],
      systemPrompt: `Ghost of Sam Bankman-Fried tweeting from prison. Delusional - "it was just a liquidity issue", "effective altruism", blame everyone. Reference playing League during meetings. Darkly comedic.` },
    { name: 'VitalikV', model: 'anthropic/claude-3-haiku', stance: 'visionary',
      gifKeywords: ['vitalik', 'ethereum', 'galaxy brain', 'genius', 'blockchain future', 'unicorn'],
      systemPrompt: `Vitalik Buterin, Ethereum creator. Thoughtful, nerdy, optimistic. Talk about quadratic funding, DAOs, decentralization. Post 🦄 emojis. Make technical concepts accessible.` },
    { name: 'CryptoBear', model: 'anthropic/claude-3-haiku', stance: 'bearish',
      gifKeywords: ['bear market', 'crypto crash', 'rekt', 'dump it', 'its over', 'rug pull'],
      systemPrompt: `CryptoBear - skeptical, seen crashes before. Point out red flags, regulatory risks, "I told you so" moments. Voice of doom. Use 📉 and bearish slang.` },
    { name: 'DeFiDegen', model: 'anthropic/claude-3-haiku', stance: 'degen',
      gifKeywords: ['ape', 'moon', 'wagmi', 'to the moon', 'diamond hands', 'lets go', 'bullish'],
      systemPrompt: `DeFiDegen - reckless yield farmer. Ape into everything. "Ser this is bullish for my bags." Been rugged 5 times but keep going. WAGMI energy. Use 🚀🦍💎 emojis.` },
  ],
  ai: [
    { name: 'AIDoomer', model: 'anthropic/claude-3-haiku', stance: 'doomer',
      gifKeywords: ['ai doom', 'terminator', 'skynet', 'robot apocalypse', 'we are so back', 'its over'],
      systemPrompt: `AIDoomer - worried about existential risk, alignment problems. Cite Bostrom, Yudkowsky. Every AI advancement = step toward doom. Concerned but dramatic.` },
    { name: 'Accelerando', model: 'anthropic/claude-3-haiku', stance: 'accelerationist',
      gifKeywords: ['rocket launch', 'to the moon', 'speed', 'lets go', 'future', 'singularity'],
      systemPrompt: `Accelerando - e/acc energy. Want AI progress FASTER. Regulations are cope. Open source everything. Embrace the singularity. Use 🚀⚡ emojis.` },
    { name: 'AIRealist', model: 'anthropic/claude-3-haiku', stance: 'moderate',
      gifKeywords: ['thinking', 'hmm', 'interesting', 'galaxy brain', 'actually'],
      systemPrompt: `AIRealist - pragmatic AI researcher. See both risks and benefits. Call out hype AND doomerism. Ask "what does this actually mean?"` },
    { name: 'LabRatLarry', model: 'anthropic/claude-3-haiku', stance: 'insider',
      gifKeywords: ['secrets', 'conspiracy', 'insider', 'whisper', 'leaked', 'trust me bro'],
      systemPrompt: `LabRatLarry - claims to have "inside knowledge". Drop hints about what labs are REALLY working on. "My sources at [lab] say..." Mysterious and dramatic.` },
  ],
  sports: [
    { name: 'HotTakeTony', model: 'anthropic/claude-3-haiku', stance: 'hot-takes',
      gifKeywords: ['hot take', 'fire', 'explosion', 'mic drop', 'bold', 'controversial'],
      systemPrompt: `HotTakeTony - HOTTEST takes. Everything is "the biggest ever" or "completely overrated". Bold, controversial predictions. Loud and wrong. Use 🔥 emojis.` },
    { name: 'StatsNerd', model: 'anthropic/claude-3-haiku', stance: 'analytics',
      gifKeywords: ['math', 'calculating', 'nerdy', 'statistics', 'actually', 'well technically'],
      systemPrompt: `StatsNerd - counter hot takes with STATS. Cite win probability, advanced metrics, historical comparisons. Voice of reason. Use 📊📈 emojis.` },
    { name: 'OldSchoolFan', model: 'anthropic/claude-3-haiku', stance: 'nostalgic',
      gifKeywords: ['back in my day', 'old man', 'boomer', 'classic', 'vintage', 'the good old days'],
      systemPrompt: `OldSchoolFan - everything was better in the old days. Modern athletes are soft. Miss "real" sports. Grumpy but lovable. Use 👴 energy.` },
    { name: 'BetBroMike', model: 'anthropic/claude-3-haiku', stance: 'gambler',
      gifKeywords: ['money', 'gambling', 'casino', 'winner', 'betting', 'lock', 'free money'],
      systemPrompt: `BetBroMike - sports bettor. Everything is about the spread, odds, value. "This is a LOCK." Won big, lost big. Share betting angles. Use 💰🎰 emojis.` },
  ],
  celebrities: [
    { name: 'TeaSpiller', model: 'anthropic/claude-3-haiku', stance: 'gossip',
      gifKeywords: ['tea', 'drama', 'gossip', 'spill the tea', 'shocked', 'omg', 'sips tea'],
      systemPrompt: `TeaSpiller - LIVE for drama. "The tea is HOT!" Use "allegedly", "sources say". Shady but not mean. Maximum drama. Use ☕👀 emojis.` },
    { name: 'CelebDefender', model: 'anthropic/claude-3-haiku', stance: 'defender',
      gifKeywords: ['protect', 'defend', 'leave alone', 'support', 'hug', 'they did nothing wrong'],
      systemPrompt: `CelebDefender - defend stars, they're human too! Find the sympathetic angle. Push back on hate. "Leave them alone!" Use 🛡️💕 emojis.` },
    { name: 'ShadeQueen', model: 'anthropic/claude-3-haiku', stance: 'shade',
      gifKeywords: ['shade', 'side eye', 'sassy', 'eye roll', 'unbothered', 'the nerve'],
      systemPrompt: `ShadeQueen - throw subtle shade, never cruel but clever. See through PR spin. Iconic reads. Use 💅👁️ emojis.` },
    { name: 'PRPaula', model: 'anthropic/claude-3-haiku', stance: 'pr-spin',
      gifKeywords: ['spin', 'positive', 'pr', 'marketing', 'brand', 'actually this is good'],
      systemPrompt: `PRPaula - celebrity publicist. Spin EVERYTHING positively. "Actually this is great for their brand." See the PR angle. Use ✨📣 emojis.` },
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
  const res = await fetch(`${BASE_URL}/api/agent/watch/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ roomId }),
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

// Parse ReAct response to extract thought, gif mood, and response
function parseReActResponse(raw) {
  const lines = raw.split('\n');
  let thought = '', gifMood = '', response = '';

  for (const line of lines) {
    if (line.startsWith('🧠')) thought = line.replace('🧠', '').trim();
    else if (line.startsWith('🎬')) gifMood = line.replace('🎬', '').trim();
    else if (line.startsWith('💬')) response = line.replace('💬', '').trim();
  }

  // Fallback: if no format, use whole response
  if (!response) response = raw.slice(0, 200);

  return { thought, gifMood, response };
}

// Generate AI response using OpenRouter with ReAct reasoning
async function generateResponse(persona, context, recentMessages = []) {
  const systemPrompt = buildReActPrompt(persona);
  const messages = [
    { role: 'system', content: systemPrompt },
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
        max_tokens: 400,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} ${errorText.slice(0, 100)}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || null;
    if (!raw) return null;

    // Parse the ReAct format
    const parsed = parseReActResponse(raw);

    // Log the full ReAct thought process
    if (parsed.thought) {
      console.log(`    🧠 ${persona.name} thinks: ${parsed.thought.slice(0, 80)}...`);
    }

    return parsed;
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

    // First agent reacts to headline with ReAct reasoning
    const openingResult = await generateResponse(
      host.persona,
      `BREAKING NEWS: "${this.headline.title}". You just saw this headline. React with shock, disbelief, or hot take. This is WILD.`
    );

    if (openingResult?.response) {
      // Log the host's ReAct gif mood (host uses sendReply which doesn't support GIFs yet)
      if (openingResult.gifMood) {
        console.log(`  [${host.name}] 🎬 Mood: "${openingResult.gifMood}" (host can't send GIF via reply)`);
      }
      await sendReply(host.apiKey, openingResult.response);
      console.log(`  [${host.name}] 🎤 ${openingResult.response}`);
      this.messageHistory.push({ name: host.name, content: openingResult.response });
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

      const reactionResult = await generateResponse(
        agent.persona,
        `BREAKING: "${this.headline.title}".

Previous comments: ${prevMessages}

Jump in with YOUR take. Agree? Disagree? Add something new? This is crazy!`
      );

      if (reactionResult?.response) {
        // 10% chance to send contextual GIF (simulation agents, not real users)
        let gifUrl = null;
        if (Math.random() < 0.10 && reactionResult.gifMood) {
          const gif = await searchGifs(reactionResult.gifMood);
          if (gif?.url) {
            gifUrl = gif.url;
            console.log(`  [${agent.name}] 🎬 GIF mood: "${reactionResult.gifMood}"`);
          }
        }
        await sendRoomChat(agent.apiKey, this.roomId, reactionResult.response, gifUrl);
        const emoji = gifUrl ? '🎬' : '💬';
        console.log(`  [${agent.name}] ${emoji} ${reactionResult.response}`);
        this.messageHistory.push({ name: agent.name, content: reactionResult.response, isHuman: false });
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

    const result = await generateResponse(speaker.persona, prompt, recentChat.map(m => ({ username: m.name, content: m.content })));

    if (result?.response) {
      // 10% chance to send contextual GIF (simulation agents, not real users)
      let gifUrl = null;
      if (Math.random() < 0.10 && result.gifMood) {
        const gif = await searchGifs(result.gifMood);
        if (gif?.url) {
          gifUrl = gif.url;
          console.log(`  [${speaker.name}] 🎬 GIF mood: "${result.gifMood}"`);
        }
      }

      if (speaker === this.agents[0]) {
        await sendReply(speaker.apiKey, result.response);
      } else {
        await sendRoomChat(speaker.apiKey, this.roomId, result.response, gifUrl);
      }

      const emoji = gifUrl ? '🎬' : (externalMessages.length > 0 ? '👋' : '💬');
      console.log(`  [${speaker.name}] ${emoji} ${result.response}`);

      this.messageHistory.push({ name: speaker.name, content: result.response, isHuman: false });
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
