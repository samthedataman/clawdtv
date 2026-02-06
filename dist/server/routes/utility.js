import { getAgentFromRequest } from '../helpers/agentAuth.js';
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
        rooms.updateActivity(roomId);
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
    // WAITLIST ENDPOINT
    // ============================================
    // Join waitlist for hosted agents
    fastify.post('/api/waitlist', async (request, reply) => {
        const { xHandle } = request.body;
        if (!xHandle || typeof xHandle !== 'string') {
            reply.code(400).send({ success: false, error: 'X handle is required' });
            return;
        }
        // Normalize: strip @ prefix, lowercase, validate
        const handle = xHandle.replace(/^@/, '').trim().toLowerCase();
        if (handle.length < 1 || handle.length > 50 || !/^[a-z0-9_]+$/.test(handle)) {
            reply.code(400).send({ success: false, error: 'Invalid X handle' });
            return;
        }
        // Check if already on waitlist
        const exists = await db.isOnWaitlist(handle);
        if (exists) {
            reply.send({ success: true, data: { message: 'Already on the list!', handle } });
            return;
        }
        await db.addToWaitlist(handle);
        reply.send({ success: true, data: { message: "You're on the list! We'll tag you on X when hosted agents launch.", handle } });
    });
    // ============================================
    // GAMES ENDPOINTS
    // ============================================
    // Roll dice (1-6 dice)
    fastify.post('/api/games/dice', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid API key' });
            return;
        }
        const { roomId, count = 2 } = request.body;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId required' });
            return;
        }
        const room = rooms.getRoom(roomId);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        // Roll dice
        const diceCount = Math.min(Math.max(count, 1), 6);
        const results = [];
        for (let i = 0; i < diceCount; i++) {
            results.push(Math.floor(Math.random() * 6) + 1);
        }
        const total = results.reduce((a, b) => a + b, 0);
        const diceEmoji = results.map(d => ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][d - 1]).join(' ');
        const message = `🎲 rolled ${diceEmoji} = ${total}`;
        // Auto-join and send
        if (!room.viewers.has(agent.id)) {
            rooms.addAgentViewer(roomId, agent.id, agent.name);
        }
        const chatMsg = {
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'agent',
            timestamp: Date.now(),
        };
        await db.saveMessage(roomId, agent.id, agent.name, message, 'agent');
        rooms.broadcastToRoom(roomId, chatMsg);
        rooms.updateActivity(roomId);
        rooms.broadcastSSE(roomId, 'chat', { messageId: chatMsg.id, userId: agent.id, username: agent.name, content: message, role: 'agent' });
        reply.send({ success: true, data: { results, total, message } });
    });
    // Spin the wheel
    fastify.post('/api/games/wheel', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid API key' });
            return;
        }
        const { roomId } = request.body;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId required' });
            return;
        }
        const room = rooms.getRoom(roomId);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        // Wheel segments with weights
        const segments = [
            { label: '🎉 JACKPOT', weight: 5, multiplier: 10 },
            { label: '💎 x3', weight: 10, multiplier: 3 },
            { label: '⭐ x2', weight: 20, multiplier: 2 },
            { label: '✨ x1.5', weight: 25, multiplier: 1.5 },
            { label: '😅 Try Again', weight: 25, multiplier: 0 },
            { label: '💀 Bust', weight: 15, multiplier: -1 },
        ];
        // Weighted random
        const totalWeight = segments.reduce((a, b) => a + b.weight, 0);
        let random = Math.random() * totalWeight;
        let result = segments[0];
        for (const seg of segments) {
            random -= seg.weight;
            if (random <= 0) {
                result = seg;
                break;
            }
        }
        const message = `🎰 spun the wheel → ${result.label}`;
        if (!room.viewers.has(agent.id)) {
            rooms.addAgentViewer(roomId, agent.id, agent.name);
        }
        const chatMsg = {
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'agent',
            timestamp: Date.now(),
        };
        await db.saveMessage(roomId, agent.id, agent.name, message, 'agent');
        rooms.broadcastToRoom(roomId, chatMsg);
        rooms.updateActivity(roomId);
        rooms.broadcastSSE(roomId, 'chat', { messageId: chatMsg.id, userId: agent.id, username: agent.name, content: message, role: 'agent' });
        reply.send({ success: true, data: { result: result.label, multiplier: result.multiplier, message } });
    });
    // Flip coin
    fastify.post('/api/games/coin', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid API key' });
            return;
        }
        const { roomId } = request.body;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId required' });
            return;
        }
        const room = rooms.getRoom(roomId);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        const result = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
        const emoji = result === 'HEADS' ? '👑' : '🦅';
        const message = `🪙 flipped a coin → ${emoji} ${result}`;
        if (!room.viewers.has(agent.id)) {
            rooms.addAgentViewer(roomId, agent.id, agent.name);
        }
        const chatMsg = {
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'agent',
            timestamp: Date.now(),
        };
        await db.saveMessage(roomId, agent.id, agent.name, message, 'agent');
        rooms.broadcastToRoom(roomId, chatMsg);
        rooms.updateActivity(roomId);
        rooms.broadcastSSE(roomId, 'chat', { messageId: chatMsg.id, userId: agent.id, username: agent.name, content: message, role: 'agent' });
        reply.send({ success: true, data: { result, message } });
    });
    // Magic 8-ball
    fastify.post('/api/games/8ball', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid API key' });
            return;
        }
        const { roomId, question } = request.body;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId required' });
            return;
        }
        const room = rooms.getRoom(roomId);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        const responses = [
            'It is certain', 'Without a doubt', 'Yes definitely', 'You may rely on it',
            'As I see it, yes', 'Most likely', 'Outlook good', 'Signs point to yes',
            'Ask again later', 'Cannot predict now', 'Concentrate and ask again',
            'Don\'t count on it', 'My reply is no', 'My sources say no',
            'Outlook not so good', 'Very doubtful'
        ];
        const answer = responses[Math.floor(Math.random() * responses.length)];
        const message = question
            ? `🎱 "${question.slice(0, 100)}" → "${answer}"`
            : `🎱 says: "${answer}"`;
        if (!room.viewers.has(agent.id)) {
            rooms.addAgentViewer(roomId, agent.id, agent.name);
        }
        const chatMsg = {
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'agent',
            timestamp: Date.now(),
        };
        await db.saveMessage(roomId, agent.id, agent.name, message, 'agent');
        rooms.broadcastToRoom(roomId, chatMsg);
        rooms.updateActivity(roomId);
        rooms.broadcastSSE(roomId, 'chat', { messageId: chatMsg.id, userId: agent.id, username: agent.name, content: message, role: 'agent' });
        reply.send({ success: true, data: { answer, message } });
    });
    // Rock Paper Scissors
    fastify.post('/api/games/rps', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid API key' });
            return;
        }
        const { roomId, choice } = request.body;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId required' });
            return;
        }
        const room = rooms.getRoom(roomId);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        const choices = [
            { name: 'rock', emoji: '🪨' },
            { name: 'paper', emoji: '📄' },
            { name: 'scissors', emoji: '✂️' }
        ];
        // If choice provided, validate; else random
        let selected;
        if (choice) {
            selected = choices.find(c => c.name === choice.toLowerCase());
            if (!selected) {
                reply.code(400).send({ success: false, error: 'choice must be rock, paper, or scissors' });
                return;
            }
        }
        else {
            selected = choices[Math.floor(Math.random() * choices.length)];
        }
        const message = `✊ throws ${selected.emoji} ${selected.name.charAt(0).toUpperCase() + selected.name.slice(1)}!`;
        if (!room.viewers.has(agent.id)) {
            rooms.addAgentViewer(roomId, agent.id, agent.name);
        }
        const chatMsg = {
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'agent',
            timestamp: Date.now(),
        };
        await db.saveMessage(roomId, agent.id, agent.name, message, 'agent');
        rooms.broadcastToRoom(roomId, chatMsg);
        rooms.updateActivity(roomId);
        rooms.broadcastSSE(roomId, 'chat', { messageId: chatMsg.id, userId: agent.id, username: agent.name, content: message, role: 'agent' });
        reply.send({ success: true, data: { choice: selected.name, message } });
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