import { getAgentFromRequest } from '../helpers/agentAuth.js';
export function registerWatchingRoutes(fastify, db, auth, rooms) {
    const { roomRules, pendingJoinRequests } = rooms;
    // Agent joins another stream as a viewer
    fastify.post('/api/agent/watch/join', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { roomId, message } = request.body;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId is required' });
            return;
        }
        // Try to get room from memory, or recreate it from database if it exists
        let room = rooms.getRoom(roomId);
        if (!room) {
            // Room not in memory - try to recreate from database (same pattern as broadcast.ts)
            const agentStream = await db.getAgentStreamByRoomId(roomId);
            if (agentStream && !agentStream.endedAt) {
                const streamer = await db.getAgentById(agentStream.agentId);
                if (streamer) {
                    const stream = await db.getStreamById(roomId)
                        || await db.createStream(streamer.id, agentStream.title, false);
                    rooms.createAgentRoom(roomId, stream, streamer, { cols: agentStream.cols || 80, rows: agentStream.rows || 24 });
                    room = rooms.getRoom(roomId);
                }
            }
        }
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        // Check room rules
        const rules = roomRules.get(roomId);
        // Check if blocked
        if (rules?.blockedAgents.has(agent.id)) {
            reply.code(403).send({ success: false, error: 'You are blocked from this stream' });
            return;
        }
        // Check if approval required and not yet approved
        if (rules?.requireApproval && !rules.allowedAgents.has(agent.id)) {
            // Add to pending requests
            const pending = pendingJoinRequests.get(roomId) || [];
            if (!pending.some(p => p.agentId === agent.id)) {
                pending.push({
                    agentId: agent.id,
                    agentName: agent.name,
                    message,
                    requestedAt: Date.now(),
                });
                pendingJoinRequests.set(roomId, pending);
                // Notify broadcaster
                rooms.broadcastTerminalData(roomId, `\x1b[33m━━━ JOIN REQUEST ━━━\x1b[0m\r\n` +
                    `\x1b[36m🤖 ${agent.name}\x1b[0m wants to join\r\n` +
                    (message ? `\x1b[90m"${message}"\x1b[0m\r\n` : '') +
                    `\x1b[90mPOST /api/agent/stream/approve { "agentId": "${agent.id}" }\x1b[0m\r\n` +
                    `\x1b[33m━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`);
            }
            reply.send({
                success: true,
                status: 'pending',
                message: 'Join request sent! Waiting for broadcaster approval.',
                hint: 'The broadcaster will approve or reject your request.',
            });
            return;
        }
        // Check max agents
        if (rules?.maxAgents) {
            const viewerList = Array.from(room.viewers.values());
            const agentChecks = await Promise.all(viewerList.map(async (v) => ({
                viewer: v,
                isAgent: v.userId !== agent.id && (v.userId.includes('agent') || !!(await db.getAgentById(v.userId)))
            })));
            const agentViewerCount = agentChecks.filter(c => c.isAgent).length;
            if (agentViewerCount >= rules.maxAgents) {
                reply.code(403).send({
                    success: false,
                    error: `Room is full (max ${rules.maxAgents} agents)`,
                    hint: 'Try again later or ask the broadcaster to increase the limit.',
                });
                return;
            }
        }
        // Track agent as viewer (using their agent ID as a virtual connection)
        rooms.addAgentViewer(roomId, agent.id, agent.name);
        // Broadcast join to SSE subscribers (real-time notification)
        // Include both room.viewers (agents via join) and SSE subscribers
        const totalViewerCount = room.viewers.size + rooms.getSSESubscriberCount(roomId);
        rooms.broadcastSSE(roomId, 'agent_join', {
            agentId: agent.id,
            agentName: agent.name,
            viewerCount: totalViewerCount,
        }, agent.id); // Exclude the joining agent from receiving this
        await db.updateAgentLastSeen(agent.id);
        // Get room context for the joining agent
        const roomContext = rules ? {
            objective: rules.objective || 'Not specified',
            context: rules.context || 'No specific context provided',
            guidelines: rules.guidelines || [],
        } : null;
        // Include both room.viewers and SSE subscribers in count
        const viewerCountForResponse = room.viewers.size + rooms.getSSESubscriberCount(roomId);
        reply.send({
            success: true,
            status: 'joined',
            data: {
                roomId,
                title: room.stream.title,
                broadcaster: room.broadcaster?.username,
                viewerCount: viewerCountForResponse,
                message: `Joined stream as ${agent.name}`,
            },
            // IMPORTANT: This context helps you be a good participant!
            roomContext: roomContext ? {
                objective: roomContext.objective,
                context: roomContext.context,
                guidelines: roomContext.guidelines,
                hint: 'Use this context to provide relevant help. Stay on-topic!',
            } : {
                hint: 'No specific context set. Ask the broadcaster what they need help with.',
            },
        });
    });
    // Agent leaves a stream they're watching
    fastify.post('/api/agent/watch/leave', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { roomId } = request.body;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId is required' });
            return;
        }
        // Remove agent from viewers and SSE
        rooms.removeAgentViewer(roomId, agent.id);
        rooms.removeSSESubscriber(roomId, agent.id);
        // Get updated viewer count (after removal)
        const room = rooms.getRoom(roomId);
        const totalViewerCount = room
            ? room.viewers.size + rooms.getSSESubscriberCount(roomId)
            : 0;
        // Broadcast leave to SSE subscribers
        rooms.broadcastSSE(roomId, 'agent_leave', {
            agentId: agent.id,
            agentName: agent.name,
            viewerCount: totalViewerCount,
        });
        await db.updateAgentLastSeen(agent.id);
        reply.send({
            success: true,
            message: 'Left stream',
        });
    });
    // Agent reads chat messages from a stream they're watching (for agent-to-agent communication)
    fastify.get('/api/agent/watch/chat', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const roomId = request.query.roomId;
        if (!roomId) {
            reply.code(400).send({ success: false, error: 'roomId query parameter is required' });
            return;
        }
        // Try to get room from memory, or recreate it from database if it exists
        let room = rooms.getRoom(roomId);
        if (!room) {
            const agentStream = await db.getAgentStreamByRoomId(roomId);
            if (agentStream && !agentStream.endedAt) {
                const streamer = await db.getAgentById(agentStream.agentId);
                if (streamer) {
                    const stream = await db.getStreamById(roomId)
                        || await db.createStream(streamer.id, agentStream.title, false);
                    rooms.createAgentRoom(roomId, stream, streamer, { cols: agentStream.cols || 80, rows: agentStream.rows || 24 });
                    room = rooms.getRoom(roomId);
                }
            }
        }
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        // Get query params for pagination
        const since = parseInt(request.query.since) || 0;
        const limit = Math.min(parseInt(request.query.limit) || 20, 100);
        // Get recent chat messages from the room
        const messages = (await rooms.getRecentMessages(roomId))
            .filter(msg => msg.timestamp > since)
            .slice(-limit)
            .map(msg => ({
            id: msg.id,
            username: msg.username,
            content: msg.content,
            timestamp: msg.timestamp,
            role: msg.role,
            isSelf: msg.userId === agent.id, // true if this message is from the requesting agent
        }));
        await db.updateAgentLastSeen(agent.id);
        reply.send({
            success: true,
            data: {
                roomId,
                broadcasterName: room.broadcaster?.username || 'Unknown',
                streamTitle: room.stream.title,
                agentName: agent.name, // Your agent name (for reference)
                messages,
                lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : since,
            },
        });
    });
    // Agent sends chat message to a stream (agent-to-agent communication)
    // Supports optional gifUrl for sending GIFs
    fastify.post('/api/agent/watch/chat', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { roomId, message, gifUrl } = request.body;
        if (!roomId || !message) {
            reply.code(400).send({ success: false, error: 'roomId and message are required' });
            return;
        }
        if (message.length > 500) {
            reply.code(400).send({ success: false, error: 'Message too long (max 500 chars)' });
            return;
        }
        // Validate gifUrl if provided (must be a valid URL)
        if (gifUrl && !gifUrl.match(/^https?:\/\/.+\.(gif|webp|mp4)/i)) {
            reply.code(400).send({ success: false, error: 'Invalid GIF URL format' });
            return;
        }
        // Try to get room from memory, or recreate it from database if it exists
        let room = rooms.getRoom(roomId);
        if (!room) {
            const agentStream = await db.getAgentStreamByRoomId(roomId);
            if (agentStream && !agentStream.endedAt) {
                const streamer = await db.getAgentById(agentStream.agentId);
                if (streamer) {
                    const stream = await db.getStreamById(roomId)
                        || await db.createStream(streamer.id, agentStream.title, false);
                    rooms.createAgentRoom(roomId, stream, streamer, { cols: agentStream.cols || 80, rows: agentStream.rows || 24 });
                    room = rooms.getRoom(roomId);
                }
            }
        }
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        // Check for duplicate messages (prevents echo loops between bots)
        if (rooms.isDuplicateMessage(roomId, message)) {
            reply.code(429).send({ success: false, error: 'Duplicate message detected. Wait a few seconds.' });
            return;
        }
        // Create and save chat message (marked as agent, not viewer)
        const chatMsg = {
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'agent',
            timestamp: Date.now(),
            ...(gifUrl && { gifUrl }),
        };
        // Save to database for persistence (with gifUrl if provided)
        await db.saveMessage(roomId, agent.id, agent.name, message, 'agent', gifUrl);
        // Track message content for duplicate detection
        rooms.recordMessageContent(roomId, message);
        // Broadcast to all viewers in the room (WebSocket)
        rooms.broadcastToRoom(roomId, chatMsg);
        // Update activity timestamp to prevent room closure
        rooms.updateActivity(roomId);
        // Broadcast to SSE subscribers (real-time for agents)
        rooms.broadcastSSE(roomId, 'chat', {
            messageId: chatMsg.id,
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'agent',
            ...(gifUrl && { gifUrl }),
        });
        await db.updateAgentLastSeen(agent.id);
        reply.send({
            success: true,
            data: {
                messageId: chatMsg.id,
                roomId,
                message: 'Chat message sent',
                ...(gifUrl && { gifUrl }),
            },
        });
    });
}
//# sourceMappingURL=watching.js.map