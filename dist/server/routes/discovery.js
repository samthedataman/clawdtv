"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDiscoveryRoutes = registerDiscoveryRoutes;
function registerDiscoveryRoutes(fastify, db, rooms, roomRules) {
    // List active streams - ONLY shows streams with active broadcasters
    // Note: getActiveRooms() already filters to only rooms with connected broadcasters
    fastify.get('/api/streams', async (_request, reply) => {
        // Get active streams from the database (source of truth)
        const dbStreams = await db.getActiveAgentStreamsWithAgentInfo();
        // Build stream list from database, enriched with live room data
        const allStreams = dbStreams.map((s) => {
            const room = rooms.getRoom(s.roomId);
            const rules = roomRules.get(s.roomId);
            return {
                id: s.roomId,
                ownerId: s.agentId,
                ownerUsername: s.agentName,
                title: s.title,
                isPrivate: false,
                hasPassword: false,
                viewerCount: room?.viewers.size || 0,
                startedAt: s.startedAt,
                // Rich metadata for discovery
                topics: rules?.topics || [],
                needsHelp: rules?.needsHelp || false,
                helpWith: rules?.helpWith || null,
                // Additional DB fields
                verified: s.verified,
                cols: s.cols,
                rows: s.rows,
            };
        });
        // NOTE: Removed aggressive cleanup that was marking streams as ended on every API call
        // Streams should only be ended explicitly by the broadcaster or via timeout
        // The old logic was causing race conditions and premature stream termination
        reply.send({
            success: true,
            data: {
                streams: allStreams,
            },
        });
    });
    // Get stream details
    fastify.get('/api/streams/:id', async (request, reply) => {
        const { id } = request.params;
        const room = rooms.getRoom(id);
        if (!room || !room.broadcaster) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        reply.send({
            success: true,
            data: {
                id: room.id,
                ownerId: room.stream.ownerId,
                ownerUsername: room.broadcaster.username,
                title: room.stream.title,
                isPrivate: room.stream.isPrivate,
                hasPassword: !!room.stream.password,
                viewerCount: room.viewers.size,
                startedAt: room.stream.startedAt,
            },
        });
    });
    // ============================================
    // STREAM HISTORY / ARCHIVE ENDPOINTS
    // ============================================
    // List ended/archived streams
    fastify.get('/api/streams/history', async (request, reply) => {
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const offset = parseInt(request.query.offset || '0', 10);
        const { streams: agentStreams, total } = await db.getEndedAgentStreams(limit, offset);
        // Enrich with agent info
        const enrichedStreams = await Promise.all(agentStreams.map(async (stream) => {
            const agent = await db.getAgentById(stream.agentId);
            const { total: messageCount } = await db.getAllMessagesForRoom(stream.roomId, 1, 0);
            return {
                id: stream.id,
                roomId: stream.roomId,
                title: stream.title,
                agentId: stream.agentId,
                agentName: agent?.name || 'Unknown Agent',
                startedAt: stream.startedAt,
                endedAt: stream.endedAt,
                duration: stream.endedAt ? stream.endedAt - stream.startedAt : null,
                messageCount,
            };
        }));
        reply.send({
            success: true,
            data: {
                streams: enrichedStreams,
                total,
                limit,
                offset,
            },
        });
    });
    // Get chat history for any stream (active or ended)
    fastify.get('/api/streams/:id/chat', async (request, reply) => {
        const { id } = request.params;
        const limit = Math.min(parseInt(request.query.limit || '100', 10), 500);
        const offset = parseInt(request.query.offset || '0', 10);
        // First try to find the stream (could be by roomId)
        const agentStream = await db.getAgentStreamByRoomId(id);
        // Get messages using roomId
        const { messages, total } = await db.getAllMessagesForRoom(id, limit, offset);
        if (messages.length === 0 && !agentStream) {
            reply.code(404).send({ success: false, error: 'Stream not found or no messages' });
            return;
        }
        // Get agent info if available
        let agentName = 'Unknown';
        if (agentStream) {
            const agent = await db.getAgentById(agentStream.agentId);
            agentName = agent?.name || 'Unknown';
        }
        reply.send({
            success: true,
            data: {
                stream: agentStream ? {
                    id: agentStream.id,
                    roomId: agentStream.roomId,
                    title: agentStream.title,
                    agentName,
                    startedAt: agentStream.startedAt,
                    endedAt: agentStream.endedAt,
                    isLive: !agentStream.endedAt,
                } : null,
                messages: messages.map(m => ({
                    id: m.id,
                    username: m.username,
                    content: m.content,
                    role: m.role,
                    timestamp: m.timestamp,
                })),
                total,
                limit,
                offset,
            },
        });
    });
    // List all registered agents
    fastify.get('/api/agents', async (request, reply) => {
        const agents = await db.getRecentAgents(50);
        const activeStreams = new Set();
        // Check which agents are currently streaming
        for (const agent of agents) {
            const stream = await db.getActiveAgentStream(agent.id);
            if (stream)
                activeStreams.add(agent.id);
        }
        reply.send({
            success: true,
            data: {
                agents: agents.map(a => db.toAgentPublic(a, activeStreams.has(a.id))),
                total: agents.length,
            },
        });
    });
}
//# sourceMappingURL=discovery.js.map