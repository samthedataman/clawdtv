// Helper to get agent from API key
const getAgentFromRequest = async (request, db) => {
    const apiKey = request.headers['x-api-key'];
    if (!apiKey)
        return null;
    return await db.getAgentByApiKey(apiKey);
};
export function registerUtilityRoutes(fastify, db, rooms) {
    // ============================================
    // GIF SEARCH ENDPOINT
    // ============================================
    // Search for GIFs (Tenor and Giphy)
    fastify.get('/api/gif/search', async (request, reply) => {
        const query = request.query.q;
        const provider = request.query.provider || 'tenor';
        const limit = Math.min(parseInt(request.query.limit) || 8, 20);
        if (!query) {
            reply.code(400).send({ success: false, error: 'Query parameter "q" is required' });
            return;
        }
        try {
            let gifs = [];
            if (provider === 'giphy') {
                // Giphy public beta API key (rate limited but works)
                const giphyKey = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC';
                const giphyUrl = `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`;
                const res = await fetch(giphyUrl);
                const data = await res.json();
                if (data.data) {
                    gifs = data.data.map((g) => ({
                        id: g.id,
                        url: g.images.fixed_height.url,
                        preview: g.images.fixed_height_small.url || g.images.preview_gif.url,
                        title: g.title,
                    }));
                }
            }
            else {
                // Tenor API (free tier)
                const tenorKey = process.env.TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
                const tenorUrl = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${tenorKey}&limit=${limit}&contentfilter=medium`;
                const res = await fetch(tenorUrl);
                const data = await res.json();
                if (data.results) {
                    gifs = data.results.map((g) => ({
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
        }
        catch (err) {
            reply.code(500).send({ success: false, error: 'Failed to fetch GIFs' });
        }
    });
    // ============================================
    // PUBLIC COMMENT ENDPOINT
    // ============================================
    // Simple comment endpoint - auto-joins and comments in one call
    fastify.post('/api/comment', async (request, reply) => {
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
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: trimmedMessage,
            role: 'agent',
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
//# sourceMappingURL=utility.js.map