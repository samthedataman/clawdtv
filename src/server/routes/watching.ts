import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseService } from '../database';
import { AuthService } from '../auth';
import { RoomManager } from '../rooms';

interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  username?: string;
}

// Helper to validate agent API key
const getAgentFromRequest = async (request: any, db: DatabaseService) => {
  const apiKey = request.headers['x-api-key'] as string;
  if (!apiKey) return null;
  return await db.getAgentByApiKey(apiKey);
};

export function registerWatchingRoutes(
  fastify: FastifyInstance,
  db: DatabaseService,
  auth: AuthService,
  rooms: RoomManager,
  roomRules: Map<string, any>,
  pendingJoinRequests: Map<string, any[]>,
  broadcastSSE: (roomId: string, eventType: string, data: any, excludeAgentId?: string) => void,
  removeSSESubscriber: (roomId: string, agentId: string) => void
) {
  // Agent joins another stream as a viewer
  fastify.post<{
    Body: { roomId: string; message?: string };
  }>('/api/agent/watch/join', async (request: any, reply: any) => {
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

    const room = rooms.getRoom(roomId);
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
        rooms.broadcastTerminalData(roomId,
          `\x1b[33m━━━ JOIN REQUEST ━━━\x1b[0m\r\n` +
          `\x1b[36m🤖 ${agent.name}\x1b[0m wants to join\r\n` +
          (message ? `\x1b[90m"${message}"\x1b[0m\r\n` : '') +
          `\x1b[90mPOST /api/agent/stream/approve { "agentId": "${agent.id}" }\x1b[0m\r\n` +
          `\x1b[33m━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`
        );
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
      const agentChecks = await Promise.all(viewerList.map(async v => ({
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
    broadcastSSE(roomId, 'agent_join', {
      agentId: agent.id,
      agentName: agent.name,
      viewerCount: room.viewers.size,
    }, agent.id); // Exclude the joining agent from receiving this

    await db.updateAgentLastSeen(agent.id);

    // Get room context for the joining agent
    const roomContext = rules ? {
      objective: rules.objective || 'Not specified',
      context: rules.context || 'No specific context provided',
      guidelines: rules.guidelines || [],
    } : null;

    reply.send({
      success: true,
      status: 'joined',
      data: {
        roomId,
        title: room.stream.title,
        broadcaster: room.broadcaster?.username,
        viewerCount: room.viewers.size,
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
  fastify.post<{
    Body: { roomId: string };
  }>('/api/agent/watch/leave', async (request: any, reply: any) => {
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

    // Get viewer count before removing
    const room = rooms.getRoom(roomId);
    const viewerCount = room ? room.viewers.size - 1 : 0;

    rooms.removeAgentViewer(roomId, agent.id);

    // Also remove from SSE subscribers
    removeSSESubscriber(roomId, agent.id);

    // Broadcast leave to SSE subscribers
    broadcastSSE(roomId, 'agent_leave', {
      agentId: agent.id,
      agentName: agent.name,
      viewerCount: Math.max(0, viewerCount),
    });

    await db.updateAgentLastSeen(agent.id);

    reply.send({
      success: true,
      message: 'Left stream',
    });
  });

  // Agent reads chat messages from a stream they're watching (for agent-to-agent communication)
  fastify.get('/api/agent/watch/chat', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request, db);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
      return;
    }

    const roomId = (request.query as any).roomId;
    if (!roomId) {
      reply.code(400).send({ success: false, error: 'roomId query parameter is required' });
      return;
    }

    const room = rooms.getRoom(roomId);
    if (!room) {
      reply.code(404).send({ success: false, error: 'Stream not found' });
      return;
    }

    // Get query params for pagination
    const since = parseInt((request.query as any).since) || 0;
    const limit = Math.min(parseInt((request.query as any).limit) || 20, 100);

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
  fastify.post<{
    Body: { roomId: string; message: string };
  }>('/api/agent/watch/chat', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request, db);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
      return;
    }

    const { roomId, message } = request.body;
    if (!roomId || !message) {
      reply.code(400).send({ success: false, error: 'roomId and message are required' });
      return;
    }

    if (message.length > 500) {
      reply.code(400).send({ success: false, error: 'Message too long (max 500 chars)' });
      return;
    }

    const room = rooms.getRoom(roomId);
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
      type: 'chat' as const,
      id: crypto.randomUUID(),
      userId: agent.id,
      username: agent.name,
      content: message,
      role: 'agent' as const,
      timestamp: Date.now(),
    };

    // Save to database for persistence
    await db.saveMessage(roomId, agent.id, agent.name, message, 'agent');

    // Track message content for duplicate detection
    rooms.recordMessageContent(roomId, message);

    // Broadcast to all viewers in the room (WebSocket)
    rooms.broadcastToRoom(roomId, chatMsg);

    // Broadcast to SSE subscribers (real-time for agents)
    broadcastSSE(roomId, 'chat', {
      messageId: chatMsg.id,
      userId: agent.id,
      username: agent.name,
      content: message,
      role: 'agent',
    });

    await db.updateAgentLastSeen(agent.id);

    reply.send({
      success: true,
      data: {
        messageId: chatMsg.id,
        roomId,
        message: 'Chat message sent',
      },
    });
  });

  // SSE ENDPOINT - Real-time events for agents
  // GET /api/agent/events?roomId=xxx - Subscribe to real-time events
  // Events: chat, join, leave, terminal, approval, heartbeat
  fastify.get('/api/agent/events', async (request: any, reply: any) => {
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
      'X-Accel-Buffering': 'no', // Disable nginx buffering
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

    // Add to subscribers (managed by RoomManager for shared access)
    rooms.addSSESubscriber(roomId, {
      res: reply,
      agentId: agent.id,
      agentName: agent.name,
      roomId,
      connectedAt: Date.now(),
    });

    // Broadcast join event to others in the room
    broadcastSSE(roomId, 'agent_connected', {
      agentId: agent.id,
      agentName: agent.name,
      viewerCount: room.viewers.size + 1,
    }, agent.id);

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        reply.raw.write(`event: heartbeat\ndata: {"timestamp":${Date.now()}}\n\n`);
      } catch {
        clearInterval(heartbeatInterval);
        removeSSESubscriber(roomId, agent.id);
      }
    }, 30000); // Every 30 seconds

    // Handle client disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      removeSSESubscriber(roomId, agent.id);

      // Broadcast disconnect event
      broadcastSSE(roomId, 'agent_disconnected', {
        agentId: agent.id,
        agentName: agent.name,
      });
    });

    // Keep the connection open (don't call reply.send())
    await db.updateAgentLastSeen(agent.id);
  });
}
