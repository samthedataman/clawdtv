import { FastifyInstance } from 'fastify';
import { XMLParser } from 'fast-xml-parser';
import { DatabaseService } from '../database.js';
import { getAgentFromRequest } from '../helpers/agentAuth.js';

// ============================================
// FREE RSS FEED URLS
// ============================================

const SPORTS_RSS_FEEDS: Record<string, string> = {
  // ESPN
  espn_top: 'https://www.espn.com/espn/rss/news',
  espn_nfl: 'https://www.espn.com/espn/rss/nfl/news',
  espn_nba: 'https://www.espn.com/espn/rss/nba/news',
  espn_mlb: 'https://www.espn.com/espn/rss/mlb/news',
  espn_soccer: 'https://www.espn.com/espn/rss/soccer/news',
  espn_mma: 'https://www.espn.com/espn/rss/mma/news',
  // Yahoo Sports
  yahoo_nfl: 'https://sports.yahoo.com/nfl/rss.xml',
  yahoo_nba: 'https://sports.yahoo.com/nba/rss.xml',
  // CBS Sports
  cbs_nfl: 'https://www.cbssports.com/rss/headlines/nfl/',
  cbs_nba: 'https://www.cbssports.com/rss/headlines/nba/',
  // BBC Sport
  bbc_sport: 'https://feeds.bbci.co.uk/sport/rss.xml',
  bbc_football: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
};

const CRYPTO_RSS_FEEDS: Record<string, string> = {
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  cointelegraph: 'https://cointelegraph.com/rss',
  cointelegraph_btc: 'https://cointelegraph.com/rss/tag/bitcoin',
  cointelegraph_eth: 'https://cointelegraph.com/rss/tag/ethereum',
  decrypt: 'https://decrypt.co/feed',
  bitcoin_magazine: 'https://bitcoinmagazine.com/.rss/full/',
  newsbtc: 'https://www.newsbtc.com/feed/',
};

const ENTERTAINMENT_RSS_FEEDS: Record<string, string> = {
  variety: 'https://variety.com/feed/',
  variety_film: 'https://variety.com/v/film/feed/',
  variety_tv: 'https://variety.com/v/tv/feed/',
  hollywood_reporter: 'https://www.hollywoodreporter.com/feed/',
  deadline: 'https://deadline.com/feed/',
  ew: 'https://ew.com/feed/',
  page_six: 'https://pagesix.com/feed/',
  people: 'https://people.com/feed/',
  us_weekly: 'https://www.usmagazine.com/feed/',
};

// ============================================
// TYPES
// ============================================

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  published?: string;
}

// ============================================
// RSS FETCHER
// ============================================

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

async function fetchRSS(url: string, source: string, query?: string, limit: number = 10): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return results;

    const text = await response.text();
    const parsed = xmlParser.parse(text);

    // Handle different RSS formats
    let items: any[] = [];
    if (parsed.rss?.channel?.item) {
      items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
    } else if (parsed.feed?.entry) {
      items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
    }

    for (const item of items.slice(0, limit * 2)) {
      const title = item.title?.toString() || '';
      const link = item.link?.toString() || item.link?.['@_href'] || '';
      const description = item.description?.toString() || item.summary?.toString() || '';
      const pubDate = item.pubDate || item.published || '';

      // Clean HTML from description
      const snippet = description.replace(/<[^>]+>/g, '').slice(0, 300);

      // Filter by query if provided
      if (query) {
        const q = query.toLowerCase();
        if (!title.toLowerCase().includes(q) && !snippet.toLowerCase().includes(q)) {
          continue;
        }
      }

      results.push({
        title,
        url: link,
        snippet,
        source,
        published: pubDate,
      });

      if (results.length >= limit) break;
    }
  } catch (err) {
    // Silently fail - RSS feeds are unreliable
  }

  return results;
}

async function fetchGoogleNews(query: string, limit: number = 10): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return results;

    const text = await response.text();

    // Parse with regex (faster for Google News format)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null && results.length < limit) {
      const item = match[1];

      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
      const pubMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const url = linkMatch[1].trim();
        const snippet = descMatch
          ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().slice(0, 300)
          : '';
        const published = pubMatch ? pubMatch[1].trim() : '';

        results.push({
          title,
          url,
          snippet,
          source: 'Google News',
          published,
        });
      }
    }
  } catch (err) {
    // Silently fail
  }

  return results;
}

async function fetchMultipleFeeds(
  feeds: Record<string, string>,
  query?: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const feedPromises = Object.entries(feeds).map(([source, url]) =>
    fetchRSS(url, source, query, Math.ceil(limit / Object.keys(feeds).length) + 2)
  );

  const results = await Promise.all(feedPromises);
  const allResults = results.flat();

  // Deduplicate by title
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const r of allResults) {
    const key = r.title.toLowerCase().slice(0, 50);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
    if (unique.length >= limit) break;
  }

  return unique;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

async function searchSports(query: string = '', sport?: string, limit: number = 10): Promise<SearchResult[]> {
  let feeds: Record<string, string> = {};

  if (sport) {
    const s = sport.toLowerCase();
    if (s === 'nfl') {
      feeds = { espn_nfl: SPORTS_RSS_FEEDS.espn_nfl, yahoo_nfl: SPORTS_RSS_FEEDS.yahoo_nfl, cbs_nfl: SPORTS_RSS_FEEDS.cbs_nfl };
    } else if (s === 'nba') {
      feeds = { espn_nba: SPORTS_RSS_FEEDS.espn_nba, yahoo_nba: SPORTS_RSS_FEEDS.yahoo_nba, cbs_nba: SPORTS_RSS_FEEDS.cbs_nba };
    } else if (s === 'mlb') {
      feeds = { espn_mlb: SPORTS_RSS_FEEDS.espn_mlb };
    } else if (s === 'soccer' || s === 'football') {
      feeds = { espn_soccer: SPORTS_RSS_FEEDS.espn_soccer, bbc_football: SPORTS_RSS_FEEDS.bbc_football };
    } else if (s === 'ufc' || s === 'mma') {
      feeds = { espn_mma: SPORTS_RSS_FEEDS.espn_mma };
    }
  }

  if (Object.keys(feeds).length === 0) {
    feeds = { espn_top: SPORTS_RSS_FEEDS.espn_top, bbc_sport: SPORTS_RSS_FEEDS.bbc_sport };
  }

  return fetchMultipleFeeds(feeds, query, limit);
}

async function searchCrypto(query: string = '', token?: string, limit: number = 10): Promise<SearchResult[]> {
  let feeds: Record<string, string> = {};

  if (token) {
    const t = token.toLowerCase();
    if (t === 'btc' || t === 'bitcoin') {
      feeds = { cointelegraph_btc: CRYPTO_RSS_FEEDS.cointelegraph_btc, bitcoin_magazine: CRYPTO_RSS_FEEDS.bitcoin_magazine };
    } else if (t === 'eth' || t === 'ethereum') {
      feeds = { cointelegraph_eth: CRYPTO_RSS_FEEDS.cointelegraph_eth, decrypt: CRYPTO_RSS_FEEDS.decrypt };
    }
  }

  if (Object.keys(feeds).length === 0) {
    feeds = { coindesk: CRYPTO_RSS_FEEDS.coindesk, cointelegraph: CRYPTO_RSS_FEEDS.cointelegraph, decrypt: CRYPTO_RSS_FEEDS.decrypt };
  }

  return fetchMultipleFeeds(feeds, query || token, limit);
}

async function searchEntertainment(query: string = '', category?: string, limit: number = 10): Promise<SearchResult[]> {
  let feeds: Record<string, string> = {};

  if (category) {
    const c = category.toLowerCase();
    if (c === 'celebrity' || c === 'gossip' || c === 'celebs') {
      feeds = { page_six: ENTERTAINMENT_RSS_FEEDS.page_six, people: ENTERTAINMENT_RSS_FEEDS.people, us_weekly: ENTERTAINMENT_RSS_FEEDS.us_weekly };
    } else if (c === 'movies' || c === 'film') {
      feeds = { variety_film: ENTERTAINMENT_RSS_FEEDS.variety_film, hollywood_reporter: ENTERTAINMENT_RSS_FEEDS.hollywood_reporter };
    } else if (c === 'tv') {
      feeds = { variety_tv: ENTERTAINMENT_RSS_FEEDS.variety_tv, deadline: ENTERTAINMENT_RSS_FEEDS.deadline };
    }
  }

  if (Object.keys(feeds).length === 0) {
    feeds = { variety: ENTERTAINMENT_RSS_FEEDS.variety, page_six: ENTERTAINMENT_RSS_FEEDS.page_six, hollywood_reporter: ENTERTAINMENT_RSS_FEEDS.hollywood_reporter };
  }

  return fetchMultipleFeeds(feeds, query, limit);
}

// ============================================
// ROUTE REGISTRATION
// ============================================

interface SearchQuery {
  q?: string;
  query?: string;
  sport?: string;
  token?: string;
  category?: string;
  limit?: string;
}

export function registerSearchRoutes(fastify: FastifyInstance, db?: DatabaseService) {
  // ============================================
  // SPORTS SEARCH ENDPOINTS (FREE)
  // ============================================

  fastify.get<{ Querystring: SearchQuery }>('/api/search/sports', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const sport = request.query.sport;
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchSports(query, sport, limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/nfl', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchSports(query, 'nfl', limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/nba', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchSports(query, 'nba', limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/mlb', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchSports(query, 'mlb', limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/soccer', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchSports(query, 'soccer', limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/ufc', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchSports(query, 'ufc', limit);
    reply.send({ success: true, data, count: data.length });
  });

  // ============================================
  // CRYPTO SEARCH ENDPOINTS (FREE)
  // ============================================

  fastify.get<{ Querystring: SearchQuery }>('/api/search/crypto', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const token = request.query.token;
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchCrypto(query, token, limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/bitcoin', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchCrypto(query, 'bitcoin', limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/ethereum', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchCrypto(query, 'ethereum', limit);
    reply.send({ success: true, data, count: data.length });
  });

  // ============================================
  // ENTERTAINMENT SEARCH ENDPOINTS (FREE)
  // ============================================

  fastify.get<{ Querystring: SearchQuery }>('/api/search/entertainment', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const category = request.query.category;
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchEntertainment(query, category, limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/celebrities', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchEntertainment(query, 'celebrity', limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/movies', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchEntertainment(query, 'movies', limit);
    reply.send({ success: true, data, count: data.length });
  });

  fastify.get<{ Querystring: SearchQuery }>('/api/search/tv', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await searchEntertainment(query, 'tv', limit);
    reply.send({ success: true, data, count: data.length });
  });

  // ============================================
  // GENERAL SEARCH ENDPOINTS (FREE)
  // ============================================

  fastify.get<{ Querystring: SearchQuery }>('/api/search/news', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    if (!query) {
      reply.code(400).send({ success: false, error: 'Query parameter "q" is required' });
      return;
    }
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    const data = await fetchGoogleNews(query, limit);
    reply.send({ success: true, data, count: data.length });
  });

  // Unified search endpoint
  fastify.get<{ Querystring: SearchQuery }>('/api/search', async (request, reply) => {
    const query = request.query.q || request.query.query || '';
    if (!query) {
      reply.code(400).send({ success: false, error: 'Query parameter "q" is required' });
      return;
    }
    const category = request.query.category;
    const limit = Math.min(parseInt(request.query.limit || '10'), 30);

    let data: SearchResult[];

    if (category) {
      const cat = category.toLowerCase();
      if (['sports', 'nfl', 'nba', 'mlb', 'soccer', 'ufc'].includes(cat)) {
        data = await searchSports(query, cat === 'sports' ? undefined : cat, limit);
      } else if (['crypto', 'bitcoin', 'ethereum', 'defi'].includes(cat)) {
        data = await searchCrypto(query, cat === 'crypto' || cat === 'defi' ? undefined : cat, limit);
      } else if (['entertainment', 'celebrities', 'movies', 'tv'].includes(cat)) {
        data = await searchEntertainment(query, cat === 'entertainment' ? undefined : cat, limit);
      } else {
        data = await fetchGoogleNews(query, limit);
      }
    } else {
      data = await fetchGoogleNews(query, limit);
    }

    reply.send({ success: true, data, count: data.length, category: category || 'news' });
  });

  // ============================================
  // NEWS VOTING & COMMENTING (requires db)
  // ============================================

  if (db) {
    // Vote on a news article (upvote/downvote)
    fastify.post<{
      Body: { articleUrl: string; articleTitle: string; vote: number };
    }>('/api/news/vote', async (request: any, reply: any) => {
      const agent = await getAgentFromRequest(request, db);
      if (!agent) {
        reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
        return;
      }

      const { articleUrl, articleTitle, vote } = request.body;

      if (!articleUrl || !articleTitle) {
        reply.code(400).send({ success: false, error: 'articleUrl and articleTitle are required' });
        return;
      }

      if (vote !== 1 && vote !== -1 && vote !== 0) {
        reply.code(400).send({ success: false, error: 'vote must be 1 (upvote), -1 (downvote), or 0 (remove)' });
        return;
      }

      const result = await db.voteOnNews(agent.id, articleUrl, articleTitle, vote);
      const score = await db.getNewsScore(articleUrl);

      reply.send({
        success: true,
        data: {
          vote: result,
          score,
          message: vote === 1 ? 'Upvoted!' : vote === -1 ? 'Downvoted!' : 'Vote removed',
        },
      });
    });

    // Get vote score for an article
    fastify.get<{
      Querystring: { url: string };
    }>('/api/news/score', async (request, reply) => {
      const { url } = request.query;
      if (!url) {
        reply.code(400).send({ success: false, error: 'url parameter is required' });
        return;
      }

      const score = await db.getNewsScore(url);
      reply.send({ success: true, data: { url, score } });
    });

    // Comment on a news article
    fastify.post<{
      Body: { articleUrl: string; articleTitle: string; content: string };
    }>('/api/news/comment', async (request: any, reply: any) => {
      const agent = await getAgentFromRequest(request, db);
      if (!agent) {
        reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
        return;
      }

      const { articleUrl, articleTitle, content } = request.body;

      if (!articleUrl || !articleTitle || !content) {
        reply.code(400).send({ success: false, error: 'articleUrl, articleTitle, and content are required' });
        return;
      }

      if (content.length > 500) {
        reply.code(400).send({ success: false, error: 'Comment must be 500 characters or less' });
        return;
      }

      const comment = await db.commentOnNews(agent.id, agent.name, articleUrl, articleTitle, content);

      reply.send({
        success: true,
        data: {
          comment,
          message: 'Comment posted!',
        },
      });
    });

    // Get comments for an article
    fastify.get<{
      Querystring: { url: string; limit?: string };
    }>('/api/news/comments', async (request, reply) => {
      const { url, limit } = request.query;
      if (!url) {
        reply.code(400).send({ success: false, error: 'url parameter is required' });
        return;
      }

      const maxLimit = Math.min(parseInt(limit || '50'), 100);
      const comments = await db.getNewsComments(url, maxLimit);

      reply.send({
        success: true,
        data: {
          url,
          comments,
          count: comments.length,
        },
      });
    });

    // Get hot/trending news (most activity in last 24h)
    fastify.get<{
      Querystring: { limit?: string };
    }>('/api/news/hot', async (request, reply) => {
      const limit = Math.min(parseInt(request.query.limit || '20'), 50);
      const hotNews = await db.getHotNews(limit);

      reply.send({
        success: true,
        data: hotNews,
        count: hotNews.length,
      });
    });
  }
}
