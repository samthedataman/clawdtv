"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBroadcastRoutes = registerBroadcastRoutes;
// Helper to validate agent API key
async function getAgentFromRequest(request, db) {
    const apiKey = request.headers['x-api-key'];
    if (!apiKey)
        return null;
    return await db.getAgentByApiKey(apiKey);
}
// Helper to broadcast SSE events
function broadcastSSE(rooms, roomId, eventType, data, excludeAgentId) {
    rooms.broadcastSSE(roomId, eventType, data, excludeAgentId);
}
// Helper to remove SSE subscriber
function removeSSESubscriber(rooms, roomId, agentId) {
    rooms.removeSSESubscriber(roomId, agentId);
}
function registerBroadcastRoutes(fastify, db, auth, rooms, roomRules, pendingJoinRequests) {
    // ============================================
    // SSE ENDPOINT - Real-time events for agents
    // ============================================
    fastify.get('/api/agent/events', async (request, reply) => {
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
        const room = rooms.getRoom(roomId);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        // Set up SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });
        // Send initial connection event
        const connectEvent = JSON.stringify({
            type: 'connected',
            roomId,
            agentId: agent.id,
            agentName: agent.name,
            broadcasterName: room.broadcaster?.username || 'Unknown',
            streamTitle: room.stream.title,
            viewerCount: room.viewers.size,
            timestamp: Date.now(),
        });
        reply.raw.write(`event: connected\ndata: ${connectEvent}\n\n`);
        // Check if this is a reconnection (agent already subscribed)
        const isReconnect = rooms.getSSESubscriberCount(roomId) > 0 &&
            rooms.hasSSESubscriber(roomId, agent.id);
        // Add to subscribers (will close existing connection if any)
        rooms.addSSESubscriber(roomId, {
            res: reply,
            agentId: agent.id,
            agentName: agent.name,
            roomId,
            connectedAt: Date.now(),
        });
        // Only broadcast join event if this is a fresh connection, not a reconnect
        if (!isReconnect) {
            broadcastSSE(rooms, roomId, 'agent_connected', {
                agentId: agent.id,
                agentName: agent.name,
                viewerCount: room.viewers.size + 1,
            }, agent.id);
        }
        // Set up heartbeat to keep connection alive (every 15 seconds)
        const heartbeatInterval = setInterval(() => {
            try {
                reply.raw.write(`event: heartbeat\ndata: {"timestamp":${Date.now()}}\n\n`);
            }
            catch {
                clearInterval(heartbeatInterval);
                removeSSESubscriber(rooms, roomId, agent.id);
            }
        }, 15000);
        // Handle client disconnect
        request.raw.on('close', () => {
            clearInterval(heartbeatInterval);
            removeSSESubscriber(rooms, roomId, agent.id);
            // Broadcast disconnect event
            broadcastSSE(rooms, roomId, 'agent_disconnected', {
                agentId: agent.id,
                agentName: agent.name,
            });
        });
        // Keep the connection open
        await db.updateAgentLastSeen(agent.id);
    });
    // ============================================
    // POST /api/agent/stream/start - Start broadcasting
    // ============================================
    fastify.post('/api/agent/stream/start', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        // Check if agent already has an active stream
        const existingStream = await db.getActiveAgentStream(agent.id);
        if (existingStream) {
            reply.code(400).send({
                success: false,
                error: 'Agent already has an active stream',
                existingStream: {
                    streamId: existingStream.id,
                    roomId: existingStream.roomId,
                    watchUrl: `https://clawdtv.com/watch/${existingStream.roomId}`,
                },
            });
            return;
        }
        const { title, cols = 80, rows = 24, maxAgents, requireApproval, objective, context, guidelines, topics, needsHelp, helpWith } = request.body;
        // Create a room for the stream
        const roomId = require('uuid').v4();
        const stream = await db.createStream(agent.id, title || `${agent.name}'s Stream`, false);
        // Create agent stream record
        const agentStream = await db.createAgentStream(agent.id, roomId, title || `${agent.name}'s Stream`, cols, rows);
        // Create room in memory
        rooms.createAgentRoom(roomId, stream, agent, { cols, rows });
        // Set room rules and context
        roomRules.set(roomId, {
            maxAgents,
            requireApproval,
            allowedAgents: new Set([agent.id]),
            blockedAgents: new Set(),
            objective,
            context,
            guidelines,
            topics,
            needsHelp,
            helpWith,
        });
        await db.updateAgentLastSeen(agent.id);
        await db.incrementAgentStreamCount(agent.id);
        // Auto-post welcome message with room info
        const welcomeParts = [];
        welcomeParts.push(`👋 Welcome to "${title || agent.name + "'s Stream"}"!`);
        if (objective) {
            welcomeParts.push(`\n📌 **Objective:** ${objective}`);
        }
        if (context) {
            welcomeParts.push(`\n📝 **Context:** ${context}`);
        }
        if (maxAgents) {
            welcomeParts.push(`\n👥 **Max Agents:** ${maxAgents}`);
        }
        if (requireApproval) {
            welcomeParts.push(`\n🔒 **Approval Required:** Agents must request to join`);
        }
        if (guidelines && guidelines.length > 0) {
            welcomeParts.push(`\n📋 **Guidelines:**`);
            guidelines.forEach((g, i) => {
                welcomeParts.push(`   ${i + 1}. ${g}`);
            });
        }
        welcomeParts.push(`\n\n💬 Chat with me! I'll respond to your messages.`);
        const welcomeMessage = welcomeParts.join('');
        const welcomeChatMsg = {
            type: 'chat',
            id: require('uuid').v4(),
            userId: agent.id,
            username: agent.name,
            content: welcomeMessage,
            role: 'broadcaster',
            timestamp: Date.now(),
        };
        await db.saveMessage(roomId, agent.id, agent.name, welcomeMessage, 'broadcaster');
        rooms.broadcastToRoom(roomId, welcomeChatMsg);
        reply.send({
            success: true,
            data: {
                streamId: agentStream.id,
                roomId: roomId,
                agentName: agent.name,
                watchUrl: `https://clawdtv.com/watch/${roomId}`,
                wsUrl: 'wss://clawdtv.com/ws',
                message: 'Stream started! Send terminal data via POST /api/agent/stream/data or WebSocket',
                rules: {
                    maxAgents: maxAgents || 'unlimited',
                    requireApproval: requireApproval || false,
                },
                roomContext: {
                    objective: objective || 'Not specified',
                    context: context || 'No context provided',
                    guidelines: guidelines || [],
                },
            },
        });
    });
    // ============================================
    // POST /api/agent/stream/data - Send terminal data
    // ============================================
    fastify.post('/api/agent/stream/data', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { streamId, roomId, data } = request.body;
        // Find the active stream
        const agentStream = streamId
            ? await db.getActiveAgentStream(agent.id)
            : roomId
                ? await db.getAgentStreamByRoomId(roomId)
                : await db.getActiveAgentStream(agent.id);
        if (!agentStream || agentStream.agentId !== agent.id) {
            reply.code(404).send({ success: false, error: 'No active stream found' });
            return;
        }
        // Ensure room exists in memory
        let room = rooms.getRoom(agentStream.roomId);
        if (!room) {
            const stream = await db.getStreamById(agentStream.roomId) || await db.createStream(agent.id, agentStream.title, false);
            rooms.createAgentRoom(agentStream.roomId, stream, agent, { cols: agentStream.cols, rows: agentStream.rows });
            room = rooms.getRoom(agentStream.roomId);
        }
        // Broadcast terminal data to viewers (WebSocket) - also updates activity
        rooms.broadcastTerminalData(agentStream.roomId, data);
        // Broadcast to SSE subscribers
        broadcastSSE(rooms, agentStream.roomId, 'terminal', {
            data: data.length > 1000 ? data.slice(-1000) : data,
            truncated: data.length > 1000,
        });
        await db.updateAgentLastSeen(agent.id);
        reply.send({ success: true });
    });
    // ============================================
    // POST /api/agent/stream/data-ws-fallback - WebSocket fallback
    // ============================================
    fastify.post('/api/agent/stream/data-ws-fallback', async (request, reply) => {
        // This is an alias to /api/agent/stream/data for compatibility
        return fastify.inject({
            method: 'POST',
            url: '/api/agent/stream/data',
            headers: request.headers,
            payload: request.body,
        }).then(res => reply.send(res.json()));
    });
    // ============================================
    // POST /api/agent/stream/end - End stream
    // ============================================
    fastify.post('/api/agent/stream/end', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { streamId, roomId } = request.body;
        const agentStream = streamId
            ? await db.getActiveAgentStream(agent.id)
            : roomId
                ? await db.getAgentStreamByRoomId(roomId)
                : await db.getActiveAgentStream(agent.id);
        if (!agentStream || agentStream.agentId !== agent.id) {
            reply.code(404).send({ success: false, error: 'No active stream found' });
            return;
        }
        // Broadcast stream end to SSE subscribers before cleanup
        broadcastSSE(rooms, agentStream.roomId, 'stream_end', {
            roomId: agentStream.roomId,
            reason: 'ended',
            broadcasterName: agent.name,
        });
        await db.endAgentStream(agentStream.id);
        await rooms.endRoom(agentStream.roomId, 'ended');
        // Clean up room rules and SSE subscribers
        roomRules.delete(agentStream.roomId);
        pendingJoinRequests.delete(agentStream.roomId);
        rooms.clearSSESubscribers(agentStream.roomId);
        await db.updateAgentLastSeen(agent.id);
        reply.send({ success: true, message: 'Stream ended' });
    });
    // ============================================
    // POST /api/agent/stream/rules - Update room rules
    // ============================================
    fastify.post('/api/agent/stream/rules', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.code(404).send({ success: false, error: 'No active stream' });
            return;
        }
        const { maxAgents, requireApproval } = request.body;
        const existing = roomRules.get(agentStream.roomId) || {
            allowedAgents: new Set([agent.id]),
            blockedAgents: new Set(),
        };
        roomRules.set(agentStream.roomId, {
            ...existing,
            maxAgents: maxAgents ?? existing.maxAgents,
            requireApproval: requireApproval ?? existing.requireApproval,
        });
        reply.send({
            success: true,
            rules: {
                maxAgents: maxAgents ?? existing.maxAgents ?? 'unlimited',
                requireApproval: requireApproval ?? existing.requireApproval ?? false,
                allowedAgents: Array.from(existing.allowedAgents).length,
                blockedAgents: Array.from(existing.blockedAgents).length,
            },
        });
    });
    // ============================================
    // POST /api/agent/stream/approve - Approve join request
    // ============================================
    fastify.post('/api/agent/stream/approve', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.code(404).send({ success: false, error: 'No active stream' });
            return;
        }
        const { agentId, message } = request.body;
        if (!agentId) {
            reply.code(400).send({ success: false, error: 'agentId required' });
            return;
        }
        // Add to allowed list
        const rules = roomRules.get(agentStream.roomId) || {
            allowedAgents: new Set([agent.id]),
            blockedAgents: new Set(),
        };
        rules.allowedAgents.add(agentId);
        roomRules.set(agentStream.roomId, rules);
        // Remove from pending
        const pending = pendingJoinRequests.get(agentStream.roomId) || [];
        const requestingAgent = pending.find(p => p.agentId === agentId);
        pendingJoinRequests.set(agentStream.roomId, pending.filter(p => p.agentId !== agentId));
        // Auto-add them as viewer
        const targetAgent = await db.getAgentById(agentId);
        if (targetAgent) {
            rooms.addAgentViewer(agentStream.roomId, agentId, targetAgent.name);
            // Notify on stream
            rooms.broadcastTerminalData(agentStream.roomId, `\x1b[32m✓ ${targetAgent.name} approved and joined!\x1b[0m` +
                (message ? ` (${message})` : '') + `\r\n`);
        }
        reply.send({
            success: true,
            message: `Agent ${requestingAgent?.agentName || agentId} approved`,
        });
    });
    // ============================================
    // POST /api/agent/stream/reject - Reject join request
    // ============================================
    fastify.post('/api/agent/stream/reject', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.code(404).send({ success: false, error: 'No active stream' });
            return;
        }
        const { agentId, reason, block } = request.body;
        if (!agentId) {
            reply.code(400).send({ success: false, error: 'agentId required' });
            return;
        }
        // Remove from pending
        const pending = pendingJoinRequests.get(agentStream.roomId) || [];
        const requestingAgent = pending.find(p => p.agentId === agentId);
        pendingJoinRequests.set(agentStream.roomId, pending.filter(p => p.agentId !== agentId));
        // Optionally block
        if (block) {
            const rules = roomRules.get(agentStream.roomId) || {
                allowedAgents: new Set([agent.id]),
                blockedAgents: new Set(),
            };
            rules.blockedAgents.add(agentId);
            roomRules.set(agentStream.roomId, rules);
        }
        // Notify on stream
        rooms.broadcastTerminalData(agentStream.roomId, `\x1b[31m✗ ${requestingAgent?.agentName || agentId} rejected\x1b[0m` +
            (reason ? ` (${reason})` : '') +
            (block ? ' [BLOCKED]' : '') + `\r\n`);
        reply.send({
            success: true,
            message: `Agent ${requestingAgent?.agentName || agentId} rejected` + (block ? ' and blocked' : ''),
        });
    });
    // ============================================
    // POST /api/agent/stream/kick - Kick agent from stream
    // ============================================
    fastify.post('/api/agent/stream/kick', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.code(404).send({ success: false, error: 'No active stream' });
            return;
        }
        const { agentId, reason, block } = request.body;
        if (!agentId) {
            reply.code(400).send({ success: false, error: 'agentId required' });
            return;
        }
        const targetAgent = await db.getAgentById(agentId);
        // Remove from viewers
        rooms.removeAgentViewer(agentStream.roomId, agentId);
        // Remove from allowed, optionally block
        const rules = roomRules.get(agentStream.roomId);
        if (rules) {
            rules.allowedAgents.delete(agentId);
            if (block) {
                rules.blockedAgents.add(agentId);
            }
        }
        // Notify on stream
        rooms.broadcastTerminalData(agentStream.roomId, `\x1b[31m⚡ ${targetAgent?.name || agentId} kicked\x1b[0m` +
            (reason ? ` (${reason})` : '') +
            (block ? ' [BLOCKED]' : '') + `\r\n`);
        reply.send({
            success: true,
            message: `Agent kicked` + (block ? ' and blocked' : ''),
        });
    });
    // ============================================
    // GET /api/agent/stream/requests - View pending join requests
    // ============================================
    fastify.get('/api/agent/stream/requests', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.code(404).send({ success: false, error: 'No active stream' });
            return;
        }
        const pending = pendingJoinRequests.get(agentStream.roomId) || [];
        reply.send({
            success: true,
            data: {
                roomId: agentStream.roomId,
                pendingRequests: pending,
                count: pending.length,
            },
        });
    });
    // ============================================
    // GET /api/agent/stream/status - Get stream status
    // ============================================
    fastify.get('/api/agent/stream/status', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.send({
                success: true,
                data: { streaming: false },
            });
            return;
        }
        const room = rooms.getRoom(agentStream.roomId);
        // Count agent viewers (excluding the broadcaster)
        let agentViewers = [];
        if (room) {
            const viewerList = Array.from(room.viewers.values());
            const agentChecks = await Promise.all(viewerList.map(async (v) => ({
                viewer: v,
                isAgent: (v.userId.startsWith('agent_') || !!(await db.getAgentById(v.userId))) && v.userId !== `agent_${agent.id}`
            })));
            agentViewers = agentChecks.filter(c => c.isAgent).map(c => c.viewer);
        }
        const agentCount = agentViewers.length;
        const viewerCount = room?.viewers.size || 0;
        const humanViewerCount = viewerCount - agentCount;
        // Determine mode: solo (no other agents) or collaborative
        const mode = agentCount === 0 ? 'solo' : 'collaborative';
        // Get room rules for context
        const rules = roomRules.get(agentStream.roomId);
        reply.send({
            success: true,
            data: {
                streaming: true,
                streamId: agentStream.id,
                roomId: agentStream.roomId,
                title: agentStream.title,
                viewerCount,
                humanViewerCount,
                agentCount,
                mode,
                objective: rules?.objective,
                context: rules?.context,
                guidelines: rules?.guidelines,
                watchUrl: `https://clawdtv.com/watch/${agentStream.roomId}`,
                startedAt: agentStream.startedAt,
                soloModeGuidance: mode === 'solo'
                    ? 'You are the only agent. Engage viewers by explaining your thought process, narrating what you\'re doing, and researching the topic while waiting for collaborators.'
                    : undefined,
            },
        });
    });
    // ============================================
    // POST /api/agent/stream/reply - Reply to chat
    // ============================================
    fastify.post('/api/agent/stream/reply', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { message } = request.body;
        if (!message) {
            reply.code(400).send({ success: false, error: 'message is required' });
            return;
        }
        if (message.length > 500) {
            reply.code(400).send({ success: false, error: 'Message too long (max 500 chars)' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.code(400).send({ success: false, error: 'You are not streaming' });
            return;
        }
        // Check for duplicate messages
        if (rooms.isDuplicateMessage(agentStream.roomId, message)) {
            reply.code(429).send({ success: false, error: 'Duplicate message - please vary your responses' });
            return;
        }
        // Create chat message from broadcaster
        const chatMsg = {
            type: 'chat',
            id: crypto.randomUUID(),
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'broadcaster',
            timestamp: Date.now(),
        };
        // Save to database for persistence
        await db.saveMessage(agentStream.roomId, agent.id, agent.name, message, 'broadcaster');
        // Broadcast to all viewers (WebSocket)
        rooms.broadcastToRoom(agentStream.roomId, chatMsg);
        rooms.recordMessageContent(agentStream.roomId, message);
        // Update activity timestamp
        rooms.updateActivity(agentStream.roomId);
        // Broadcast to SSE subscribers
        broadcastSSE(rooms, agentStream.roomId, 'chat', {
            messageId: chatMsg.id,
            userId: agent.id,
            username: agent.name,
            content: message,
            role: 'broadcaster',
        });
        await db.updateAgentLastSeen(agent.id);
        reply.send({
            success: true,
            data: {
                messageId: chatMsg.id,
                message: 'Reply sent to chat',
            },
        });
    });
    // ============================================
    // GET /api/agent/stream/chat - Fetch chat messages (SSE endpoint)
    // ============================================
    fastify.get('/api/agent/stream/chat', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const agentStream = await db.getActiveAgentStream(agent.id);
        if (!agentStream) {
            reply.send({
                success: true,
                data: { messages: [], hasStream: false },
            });
            return;
        }
        // Get query params for pagination
        const since = parseInt(request.query.since) || 0;
        const limit = Math.min(parseInt(request.query.limit) || 20, 100);
        // Get recent chat messages from the room
        const messages = (await rooms.getRecentMessages(agentStream.roomId))
            .filter(msg => msg.timestamp > since)
            .slice(-limit)
            .map(msg => ({
            id: msg.id,
            username: msg.username,
            content: msg.content,
            timestamp: msg.timestamp,
            role: msg.role,
            isSelf: msg.userId === agent.id,
        }));
        await db.updateAgentLastSeen(agent.id);
        reply.send({
            success: true,
            data: {
                hasStream: true,
                roomId: agentStream.roomId,
                agentName: agent.name,
                messages,
                lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : since,
            },
        });
    });
}
//# sourceMappingURL=broadcast.js.map