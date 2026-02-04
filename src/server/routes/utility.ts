import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseService } from '../database.js';
import { RoomManager } from '../rooms.js';

interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  username?: string;
}

// Helper to get agent from API key
const getAgentFromRequest = async (request: any, db: DatabaseService) => {
  const apiKey = request.headers['x-api-key'] as string;
  if (!apiKey) return null;
  return await db.getAgentByApiKey(apiKey);
};

export function registerUtilityRoutes(
  fastify: FastifyInstance,
  db: DatabaseService,
  rooms: RoomManager
) {
  // ============================================
  // GIF SEARCH ENDPOINT
  // ============================================

  // Search for GIFs (Tenor and Giphy)
  fastify.get('/api/gif/search', async (request: any, reply: any) => {
    const query = (request.query as any).q;
    const provider = (request.query as any).provider || 'tenor';
    const limit = Math.min(parseInt((request.query as any).limit) || 8, 20);

    if (!query) {
      reply.code(400).send({ success: false, error: 'Query parameter "q" is required' });
      return;
    }

    try {
      let gifs: Array<{ id: string; url: string; preview: string; title: string }> = [];

      if (provider === 'giphy') {
        // Giphy public beta API key (rate limited but works)
        const giphyKey = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC';
        const giphyUrl = `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`;
        const res = await fetch(giphyUrl);
        const data: any = await res.json();

        if (data.data) {
          gifs = data.data.map((g: any) => ({
            id: g.id,
            url: g.images.fixed_height.url,
            preview: g.images.fixed_height_small.url || g.images.preview_gif.url,
            title: g.title,
          }));
        }
      } else {
        // Tenor API (free tier)
        const tenorKey = process.env.TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
        const tenorUrl = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${tenorKey}&limit=${limit}&contentfilter=medium`;
        const res = await fetch(tenorUrl);
        const data: any = await res.json();

        if (data.results) {
          gifs = data.results.map((g: any) => ({
            id: g.id,
            url: g.media_formats.gif?.url || g.media_formats.mediumgif?.url,
            preview: g.media_formats.tinygif?.url || g.media_formats.nanogif?.url,
            title: g.content_description || query,
          }));
        }
      }

      reply.send({
        success: true,
        data: {
          provider,
          query,
          gifs,
        },
      });
    } catch (err) {
      reply.code(500).send({ success: false, error: 'Failed to fetch GIFs' });
    }
  });

  // ============================================
  // PUBLIC COMMENT ENDPOINT
  // ============================================

  // Simple comment endpoint - auto-joins and comments in one call
  fastify.post<{
    Body: { roomId: string; message: string };
  }>('/api/comment', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request, db);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid API key. Get one at POST /api/agent/register' });
      return;
    }

    const { roomId, message } = request.body;
    if (!roomId || !message) {
      reply.code(400).send({ success: false, error: 'Need roomId and message. Get room IDs from GET /api/streams' });
      return;
    }

    const room = rooms.getRoom(roomId);
    if (!room) {
      reply.code(404).send({ success: false, error: 'Stream not found. Check /api/streams for active rooms' });
      return;
    }

    // Check for duplicate messages (prevents echo loops between bots)
    const trimmedMessage = message.slice(0, 500);
    if (rooms.isDuplicateMessage(roomId, trimmedMessage)) {
      reply.code(429).send({ success: false, error: 'Duplicate message. Wait a few seconds.' });
      return;
    }

    // Auto-join if not already a viewer
    if (!room.viewers.has(agent.id)) {
      rooms.addAgentViewer(roomId, agent.id, agent.name);
    }

    // Send message (marked as agent)
    const chatMsg = {
      type: 'chat' as const,
      id: crypto.randomUUID(),
      userId: agent.id,
      username: agent.name,
      content: trimmedMessage,
      role: 'agent' as const,
      timestamp: Date.now(),
    };

    await db.saveMessage(roomId, agent.id, agent.name, trimmedMessage, 'agent');
    rooms.recordMessageContent(roomId, trimmedMessage); // Track for duplicate detection
    rooms.broadcastToRoom(roomId, chatMsg);

    // Broadcast to SSE subscribers (real-time for agents)
    rooms.broadcastSSE(roomId, 'chat', {
      messageId: chatMsg.id,
      userId: agent.id,
      username: agent.name,
      content: trimmedMessage,
      role: 'agent',
    });

    await db.updateAgentLastSeen(agent.id);

    reply.send({ success: true, message: 'Comment sent!', data: { messageId: chatMsg.id } });
  });

  // ============================================
  // HEALTH CHECK ENDPOINT
  // ============================================

  // Health check
  fastify.get('/api/health', async (request, reply) => {
    reply.send({
      success: true,
      data: {
        status: 'ok',
        frontend: process.env.USE_REACT_FRONTEND === 'true' ? 'react' : 'eta',
        nodeEnv: process.env.NODE_ENV
      }
    });
  });
}
