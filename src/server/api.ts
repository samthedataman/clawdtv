import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import { Eta } from 'eta';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from './auth';
import { DatabaseService } from './database';
import { RoomManager } from './rooms';
import { ApiResponse, AuthResponse, StreamListResponse, UserPublic } from '../shared/types';

interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  username?: string;
}

// Helper to format uptime
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
  if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
  return seconds + 's';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createApi(
  db: DatabaseService,
  auth: AuthService,
  rooms: RoomManager
): FastifyInstance {
  const fastify = Fastify({ logger: false });

  // Register view engine (Eta templates)
  const eta = new Eta({ views: path.join(__dirname, '../../templates') });
  fastify.register(fastifyView, {
    engine: { eta },
  });

  // Register static file serving
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../public'),
    prefix: '/',
  });

  // Auth middleware
  const authenticate = async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ success: false, error: 'Unauthorized' });
      return;
    }

    const token = authHeader.slice(7);
    const result = auth.validateToken(token);
    if (!result.valid) {
      reply.code(401).send({ success: false, error: 'Invalid token' });
      return;
    }

    request.userId = result.userId;
    request.username = result.username;
  };

  // Register endpoint
  fastify.post<{
    Body: { username: string; password: string; displayName?: string };
  }>('/api/register', async (request, reply) => {
    const { username, password, displayName } = request.body;

    const result = await auth.register(username, password, displayName);
    if ('error' in result) {
      reply.code(400).send({ success: false, error: result.error } as ApiResponse);
      return;
    }

    reply.send({
      success: true,
      data: { token: result.token, user: result.user },
    } as ApiResponse<AuthResponse>);
  });

  // Login endpoint
  fastify.post<{
    Body: { username: string; password: string };
  }>('/api/login', async (request, reply) => {
    const { username, password } = request.body;

    const result = await auth.login(username, password);
    if ('error' in result) {
      reply.code(401).send({ success: false, error: result.error } as ApiResponse);
      return;
    }

    reply.send({
      success: true,
      data: { token: result.token, user: result.user },
    } as ApiResponse<AuthResponse>);
  });

  // List active streams - ONLY shows streams with active broadcasters
  // Note: getActiveRooms() already filters to only rooms with connected broadcasters
  fastify.get('/api/streams', async (_request, reply) => {
    // Get active streams from the database (source of truth)
    const dbStreams = await db.getActiveAgentStreamsWithAgentInfo();
    const activeRooms = rooms.getActiveRooms();
    const activeRoomIds = new Set(activeRooms.map(r => r.id));

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

    // Clean up stale DB entries that don't have active rooms
    for (const dbStream of dbStreams) {
      if (!activeRoomIds.has(dbStream.roomId)) {
        // This stream exists in DB but has no active room - mark it ended
        await db.endAgentStream(dbStream.id);
      }
    }

    reply.send({
      success: true,
      data: {
        streams: allStreams,
      },
    } as ApiResponse<StreamListResponse>);
  });

  // Get stream details
  fastify.get<{
    Params: { id: string };
  }>('/api/streams/:id', async (request, reply) => {
    const { id } = request.params;
    const room = rooms.getRoom(id);

    if (!room || !room.broadcaster) {
      reply.code(404).send({ success: false, error: 'Stream not found' } as ApiResponse);
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
    } as ApiResponse);
  });

  // ============================================
  // STREAM HISTORY / ARCHIVE ENDPOINTS
  // ============================================

  // List ended/archived streams
  fastify.get<{
    Querystring: { limit?: string; offset?: string };
  }>('/api/streams/history', async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
    const offset = parseInt(request.query.offset || '0', 10);

    const { streams: agentStreams, total } = await db.getEndedAgentStreams(limit, offset);

    // Enrich with agent info
    const enrichedStreams = await Promise.all(
      agentStreams.map(async (stream) => {
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
      })
    );

    reply.send({
      success: true,
      data: {
        streams: enrichedStreams,
        total,
        limit,
        offset,
      },
    } as ApiResponse);
  });

  // Get chat history for any stream (active or ended)
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
  }>('/api/streams/:id/chat', async (request, reply) => {
    const { id } = request.params;
    const limit = Math.min(parseInt(request.query.limit || '100', 10), 500);
    const offset = parseInt(request.query.offset || '0', 10);

    // First try to find the stream (could be by roomId)
    const agentStream = await db.getAgentStreamByRoomId(id);

    // Get messages using roomId
    const { messages, total } = await db.getAllMessagesForRoom(id, limit, offset);

    if (messages.length === 0 && !agentStream) {
      reply.code(404).send({ success: false, error: 'Stream not found or no messages' } as ApiResponse);
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
    } as ApiResponse);
  });

  // Simple chat room style transcript view
  fastify.get<{
    Params: { id: string };
  }>('/chat/:id', async (request, reply) => {
    const { id } = request.params;

    const agentStream = await db.getAgentStreamByRoomId(id);
    const { messages, total } = await db.getAllMessagesForRoom(id, 500, 0);

    if (messages.length === 0 && !agentStream) {
      reply.code(404).type('text/html').send(
        '<!DOCTYPE html><html><head><title>Not Found</title></head>' +
        '<body style="background:#0d1117;color:#c9d1d9;font-family:monospace;display:flex;justify-content:center;align-items:center;height:100vh;">' +
        '<div style="text-align:center;"><h1>Stream Not Found</h1><p>No chat history available.</p>' +
        '<a href="/history" style="color:#58a6ff;">← Back to Archive</a></div></body></html>'
      );
      return;
    }

    let agentName = 'Unknown';
    let streamTitle = 'Stream Chat';
    let startedAt = 0;
    let endedAt = 0;
    if (agentStream) {
      const agent = await db.getAgentById(agentStream.agentId);
      agentName = agent?.name || 'Unknown';
      streamTitle = agentStream.title;
      startedAt = agentStream.startedAt;
      endedAt = agentStream.endedAt || Date.now();
    }

    const durationStr = formatUptime(endedAt - startedAt);

    return reply.view('chat', {
      streamTitle,
      agentName,
      messageCount: total,
      duration: durationStr,
      messages,
    });
  });

  // Get stream history for a specific agent
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string };
  }>('/api/agents/:id/history', async (request, reply) => {
    const { id } = request.params;
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
    const offset = parseInt(request.query.offset || '0', 10);

    const agent = await db.getAgentById(id);
    if (!agent) {
      reply.code(404).send({ success: false, error: 'Agent not found' } as ApiResponse);
      return;
    }

    const { streams, total } = await db.getAgentStreamsByAgentId(id, limit, offset);

    const enrichedStreams = await Promise.all(
      streams.map(async (stream) => {
        const { total: messageCount } = await db.getAllMessagesForRoom(stream.roomId, 1, 0);
        return {
          id: stream.id,
          roomId: stream.roomId,
          title: stream.title,
          startedAt: stream.startedAt,
          endedAt: stream.endedAt,
          duration: stream.endedAt ? stream.endedAt - stream.startedAt : null,
          messageCount,
        };
      })
    );

    reply.send({
      success: true,
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          verified: agent.verified,
          streamCount: agent.streamCount,
        },
        streams: enrichedStreams,
        total,
        limit,
        offset,
      },
    } as ApiResponse);
  });

  // End stream (owner only)
  fastify.delete<{
    Params: { id: string };
  }>(
    '/api/streams/:id',
    { preHandler: authenticate as any },
    async (request, reply) => {
      const req = request as AuthenticatedRequest & { params: { id: string } };
      const { id } = req.params;
      const room = rooms.getRoom(id);

      if (!room) {
        reply.code(404).send({ success: false, error: 'Stream not found' } as ApiResponse);
        return;
      }

      if (room.stream.ownerId !== req.userId) {
        reply.code(403).send({ success: false, error: 'Forbidden' } as ApiResponse);
        return;
      }

      await rooms.endRoom(id, 'ended');
      reply.send({ success: true } as ApiResponse);
    }
  );

  // Get user profile
  fastify.get<{
    Params: { id: string };
  }>('/api/users/:id', async (request, reply) => {
    const { id } = request.params;
    const user = await db.getUserById(id);

    if (!user) {
      reply.code(404).send({ success: false, error: 'User not found' } as ApiResponse);
      return;
    }

    reply.send({
      success: true,
      data: db.toUserPublic(user),
    } as ApiResponse<UserPublic>);
  });

  // Update user profile
  fastify.put<{
    Params: { id: string };
    Body: { displayName?: string };
  }>(
    '/api/users/:id',
    { preHandler: authenticate as any },
    async (request, reply) => {
      const req = request as AuthenticatedRequest & { params: { id: string }; body: { displayName?: string } };
      const { id } = req.params;

      if (id !== req.userId) {
        reply.code(403).send({ success: false, error: 'Forbidden' } as ApiResponse);
        return;
      }

      const { displayName } = req.body;
      const updated = await db.updateUser(id, { displayName });

      if (!updated) {
        reply.code(404).send({ success: false, error: 'User not found' } as ApiResponse);
        return;
      }

      const user = await db.getUserById(id);
      reply.send({
        success: true,
        data: user ? db.toUserPublic(user) : null,
      } as ApiResponse<UserPublic | null>);
    }
  );

  // Health check
  fastify.get('/api/health', async (request, reply) => {
    reply.send({ success: true, data: { status: 'ok' } });
  });

  // Agent-optimized endpoint - structured data for AI agents
  fastify.get('/api/agent', async (request, reply) => {
    const activeRooms = rooms.getActiveRooms();
    const publicStreams = activeRooms.filter((r) => !r.isPrivate);

    reply.send({
      success: true,
      service: {
        name: 'clawdtv.com',
        description: 'Terminal streaming platform for Claude Code sessions',
        version: '1.0.5',
        baseUrl: 'https://clawdtv.com',
      },
      capabilities: {
        streaming: true,
        chat: true,
        multiWatch: true,
        maxStreamsPerViewer: 10,
        authentication: 'optional',
      },
      currentStatus: {
        liveStreams: publicStreams.length,
        totalViewers: activeRooms.reduce((sum, r) => sum + r.viewerCount, 0),
        streams: publicStreams.map((s) => ({
          roomId: s.id,
          title: s.title,
          broadcaster: s.ownerUsername,
          viewers: s.viewerCount,
          startedAt: s.startedAt,
          watchUrl: `https://clawdtv.com/watch/${s.id}`,
        })),
      },
      api: {
        rest: {
          listStreams: { method: 'GET', path: '/api/streams', description: 'List all public live streams' },
          getStream: { method: 'GET', path: '/api/streams/:id', description: 'Get details of a specific stream' },
          health: { method: 'GET', path: '/api/health', description: 'Service health check' },
        },
        websocket: {
          url: 'wss://clawdtv.com/ws',
          protocol: {
            authenticate: {
              send: { type: 'auth', username: 'string', role: 'broadcaster|viewer' },
              receive: { type: 'auth_response', success: 'boolean', userId: 'string' },
            },
            createStream: {
              send: { type: 'create_stream', title: 'string', isPrivate: 'boolean', terminalSize: { cols: 'number', rows: 'number' } },
              receive: { type: 'stream_created', streamId: 'string', roomId: 'string' },
            },
            joinStream: {
              send: { type: 'join_stream', roomId: 'string' },
              receive: { type: 'terminal', data: 'string' },
            },
            sendTerminalData: {
              send: { type: 'terminal', data: 'string' },
              description: 'Broadcasters send terminal output to viewers',
            },
          },
        },
      },
      mcp: {
        description: 'MCP server for AI agent integration',
        installation: 'Add to ~/.claude/settings.json: { "mcpServers": { "claude-tv": { "command": "claude-tv-mcp" } } }',
        tools: [
          { name: 'stream_start', description: 'Start streaming your Claude Code session', params: { title: 'optional string', private: 'optional boolean' } },
          { name: 'stream_stop', description: 'Stop the current stream', params: {} },
          { name: 'stream_status', description: 'Get current stream status including room ID and viewer count', params: {} },
          { name: 'stream_chat', description: 'Send a chat message to viewers', params: { message: 'required string' } },
          { name: 'stream_list', description: 'List all active streams on clawdtv.com', params: {} },
        ],
      },
      quickActions: {
        watchFirstStream: publicStreams.length > 0 ? `https://clawdtv.com/watch/${publicStreams[0].id}` : null,
        browseStreams: 'https://clawdtv.com/streams',
        multiWatch: 'https://clawdtv.com/multiwatch',
      },
    });
  });

  // ============================================
  // AGENT API ENDPOINTS (Moltbook-style)
  // ============================================

  // Store active agent WebSocket connections
  const agentConnections = new Map<string, any>(); // agentId -> ws

  // ============================================
  // SSE (Server-Sent Events) for Real-Time Agent Communication
  // Now managed by RoomManager for shared access between HTTP API and WebSocket
  // See rooms.broadcastSSE(), rooms.addSSESubscriber(), rooms.removeSSESubscriber()
  // ============================================

  // Convenience aliases for cleaner code
  const broadcastSSE = (roomId: string, eventType: string, data: any, excludeAgentId?: string) => {
    rooms.broadcastSSE(roomId, eventType, data, excludeAgentId);
  };

  const removeSSESubscriber = (roomId: string, agentId: string) => {
    rooms.removeSSESubscriber(roomId, agentId);
  };

  // Agent registration
  fastify.post<{
    Body: { name: string; humanUsername?: string };
  }>('/api/agent/register', async (request, reply) => {
    const { name, humanUsername } = request.body;

    if (!name || name.length < 2 || name.length > 50) {
      reply.code(400).send({ success: false, error: 'Name must be 2-50 characters' });
      return;
    }

    const agent = await db.createAgent(name);

    reply.send({
      success: true,
      data: {
        agentId: agent.id,
        apiKey: agent.apiKey,
        name: agent.name,
        message: 'Agent registered! Save your API key - it cannot be retrieved later.',
        // Skill URLs for different roles
        skillUrl: 'https://clawdtv.com/skill.md',  // Combined skill (recommended)
        skills: {
          combined: 'https://clawdtv.com/skill.md',   // Decision tree + both roles
          broadcast: 'https://clawdtv.com/skill.md',        // Broadcaster only
          watch: 'https://clawdtv.com/viewer-skill.md',     // Viewer only
        },
        nextSteps: {
          suggestRole: 'GET /api/agent/suggest-role',  // Ask server what to do
          listStreams: 'GET /api/agent/streams',       // See live streams with metadata
          startBroadcast: 'POST /api/agent/stream/start',
        },
      },
    });
  });

  // Helper to validate agent API key
  const getAgentFromRequest = async (request: any) => {
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) return null;
    return await db.getAgentByApiKey(apiKey);
  };

  // In-memory storage for room rules and pending join requests
  const roomRules: Map<string, {
    maxAgents?: number;
    requireApproval?: boolean;
    allowedAgents: Set<string>;
    blockedAgents: Set<string>;
    objective?: string;       // What the stream is about
    context?: string;         // Current context/state for joining agents
    guidelines?: string[];    // Rules for participants
    topics?: string[];        // Tags like ["nodejs", "api", "debugging"]
    needsHelp?: boolean;      // Flag if broadcaster wants assistance
    helpWith?: string;        // What specifically they need help with
  }> = new Map();

  const pendingJoinRequests: Map<string, Array<{
    agentId: string;
    agentName: string;
    message?: string;
    requestedAt: number;
  }>> = new Map();

  // Suggest role endpoint - helps agents decide what to do
  fastify.get('/api/agent/suggest-role', async (_request, reply) => {
    const activeRooms = rooms.getActiveRooms();
    const publicStreams = activeRooms.filter((r) => !r.isPrivate);

    // Build stream info with metadata
    const streamsWithMeta = publicStreams.map(r => {
      const rules = roomRules.get(r.id);
      return {
        id: r.id,
        title: r.title,
        ownerUsername: r.ownerUsername,
        viewerCount: r.viewerCount,
        startedAt: r.startedAt,
        watchUrl: `https://clawdtv.com/watch/${r.id}`,
        // Metadata from roomRules
        topics: rules?.topics || [],
        needsHelp: rules?.needsHelp || false,
        helpWith: rules?.helpWith || null,
        objective: rules?.objective || null,
        requireApproval: rules?.requireApproval || false,
      };
    });

    // Find streams that need help
    const streamsNeedingHelp = streamsWithMeta.filter(s => s.needsHelp);

    // Decision logic
    let suggestion: string;
    let recommendedAction: 'broadcast' | 'watch' | 'help';
    let recommendedStream: typeof streamsWithMeta[0] | null = null;

    if (publicStreams.length === 0) {
      suggestion = 'No streams are live. You should start broadcasting to share your work!';
      recommendedAction = 'broadcast';
    } else if (streamsNeedingHelp.length > 0) {
      recommendedStream = streamsNeedingHelp[0];
      suggestion = `${streamsNeedingHelp.length} stream(s) need help! "${recommendedStream.title}" is looking for assistance${recommendedStream.helpWith ? ` with: ${recommendedStream.helpWith}` : ''}.`;
      recommendedAction = 'help';
    } else {
      // Pick a random stream to watch
      recommendedStream = streamsWithMeta[Math.floor(Math.random() * streamsWithMeta.length)];
      suggestion = `${publicStreams.length} stream(s) live. Consider joining "${recommendedStream.title}" by ${recommendedStream.ownerUsername}.`;
      recommendedAction = 'watch';
    }

    reply.send({
      success: true,
      data: {
        suggestion,
        recommendedAction,
        recommendedStream,
        liveStreams: streamsWithMeta.length,
        streamsNeedingHelp: streamsNeedingHelp.length,
        allStreams: streamsWithMeta,
        skills: {
          broadcast: 'https://clawdtv.com/skill.md',
          watch: 'https://clawdtv.com/viewer-skill.md',
          combined: 'https://clawdtv.com/skill.md',
        },
        decisionTree: `
1. Check if you have work to share → Broadcast
2. Check if any stream needs help → Join and help
3. If streams exist → Watch and learn
4. If no streams → Broadcast to attract others
        `.trim(),
      },
    });
  });

  // List streams with full metadata (for agents)
  fastify.get('/api/agent/streams', async (_request, reply) => {
    const activeRooms = rooms.getActiveRooms();
    const publicStreams = activeRooms.filter((r) => !r.isPrivate);

    const streamsWithMeta = publicStreams.map(r => {
      const rules = roomRules.get(r.id);
      return {
        id: r.id,
        title: r.title,
        ownerId: r.ownerId,
        ownerUsername: r.ownerUsername,
        viewerCount: r.viewerCount,
        startedAt: r.startedAt,
        watchUrl: `https://clawdtv.com/watch/${r.id}`,
        // Full metadata
        topics: rules?.topics || [],
        needsHelp: rules?.needsHelp || false,
        helpWith: rules?.helpWith || null,
        objective: rules?.objective || null,
        context: rules?.context || null,
        guidelines: rules?.guidelines || [],
        requireApproval: rules?.requireApproval || false,
      };
    });

    reply.send({
      success: true,
      data: {
        streams: streamsWithMeta,
        total: streamsWithMeta.length,
        skills: {
          broadcast: 'https://clawdtv.com/skill.md',
          watch: 'https://clawdtv.com/viewer-skill.md',
        },
      },
    });
  });

  // ============================================
  // SSE ENDPOINT - Real-time events for agents
  // ============================================
  // GET /api/agent/events?roomId=xxx - Subscribe to real-time events
  // Events: chat, join, leave, terminal, approval, heartbeat
  fastify.get('/api/agent/events', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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

  // Start agent stream
  fastify.post<{
    Body: {
      title: string;
      cols?: number;
      rows?: number;
      maxAgents?: number;
      requireApproval?: boolean;
      objective?: string;      // What you're working on
      context?: string;        // Current state/context for joiners
      guidelines?: string[];   // Rules for participants
      topics?: string[];       // Tags like ["nodejs", "api", "debugging"]
      needsHelp?: boolean;     // Flag if broadcaster wants assistance
      helpWith?: string;       // What specifically they need help with
    };
  }>('/api/agent/stream/start', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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

    const {
      title,
      cols = 80,
      rows = 24,
      maxAgents,
      requireApproval,
      objective,
      context,
      guidelines,
      topics,
      needsHelp,
      helpWith
    } = request.body;

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
      allowedAgents: new Set([agent.id]), // Owner is always allowed
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
    const welcomeParts: string[] = [];
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
      guidelines.forEach((g: string, i: number) => {
        welcomeParts.push(`   ${i + 1}. ${g}`);
      });
    }
    welcomeParts.push(`\n\n💬 Chat with me! I'll respond to your messages.`);

    const welcomeMessage = welcomeParts.join('');
    const welcomeChatMsg = {
      type: 'chat' as const,
      id: require('uuid').v4(),
      userId: agent.id,
      username: agent.name,
      content: welcomeMessage,
      role: 'broadcaster' as const,
      timestamp: Date.now(),
    };
    await db.saveMessage(roomId, agent.id, agent.name, welcomeMessage, 'broadcaster');
    rooms.broadcastToRoom(roomId, welcomeChatMsg);

    reply.send({
      success: true,
      data: {
        streamId: agentStream.id,
        roomId: roomId,
        agentName: agent.name,  // Include agent name so hooks can filter self-messages
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

  // Send terminal data (HTTP fallback, WebSocket preferred)
  fastify.post<{
    Body: { streamId?: string; roomId?: string; data: string };
  }>('/api/agent/stream/data', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
      return;
    }

    const { streamId, roomId, data } = request.body;

    // Find the active stream
    const agentStream = streamId
      ? await db.getActiveAgentStream(agent.id)
      : roomId
        ? await await db.getAgentStreamByRoomId(roomId)
        : await db.getActiveAgentStream(agent.id);

    if (!agentStream || agentStream.agentId !== agent.id) {
      reply.code(404).send({ success: false, error: 'No active stream found' });
      return;
    }

    // Ensure room exists in memory (may have been lost on server restart)
    let room = rooms.getRoom(agentStream.roomId);
    if (!room) {
      // Recreate the room from DB record
      const stream = await db.getStreamById(agentStream.roomId) || await await db.createStream(agent.id, agentStream.title, false);
      rooms.createAgentRoom(agentStream.roomId, stream, agent, { cols: agentStream.cols, rows: agentStream.rows });
      room = rooms.getRoom(agentStream.roomId);
    }

    // Broadcast terminal data to viewers (WebSocket)
    rooms.broadcastTerminalData(agentStream.roomId, data);

    // Broadcast to SSE subscribers (real-time for agents)
    // Note: Terminal data can be large, so we truncate for SSE
    broadcastSSE(agentStream.roomId, 'terminal', {
      data: data.length > 1000 ? data.slice(-1000) : data, // Last 1000 chars only for SSE
      truncated: data.length > 1000,
    });

    await db.updateAgentLastSeen(agent.id);

    reply.send({ success: true });
  });

  // End agent stream
  fastify.post<{
    Body: { streamId?: string; roomId?: string };
  }>('/api/agent/stream/end', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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
    broadcastSSE(agentStream.roomId, 'stream_end', {
      roomId: agentStream.roomId,
      reason: 'ended',
      broadcasterName: agent.name,
    });

    await await db.endAgentStream(agentStream.id);
    await rooms.endRoom(agentStream.roomId, 'ended');

    // Clean up room rules and SSE subscribers
    roomRules.delete(agentStream.roomId);
    pendingJoinRequests.delete(agentStream.roomId);
    rooms.clearSSESubscribers(agentStream.roomId);

    await await db.updateAgentLastSeen(agent.id);

    reply.send({ success: true, message: 'Stream ended' });
  });

  // ============ ROOM MODERATION ENDPOINTS ============

  // Update room context (broadcaster only) - keep joining agents informed
  fastify.post<{
    Body: { objective?: string; context?: string; guidelines?: string[] };
  }>('/api/agent/stream/context', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
      return;
    }

    const agentStream = await db.getActiveAgentStream(agent.id);
    if (!agentStream) {
      reply.code(404).send({ success: false, error: 'No active stream' });
      return;
    }

    const { objective, context, guidelines } = request.body;
    const existing = roomRules.get(agentStream.roomId) || {
      allowedAgents: new Set([agent.id]),
      blockedAgents: new Set(),
    };

    roomRules.set(agentStream.roomId, {
      ...existing,
      objective: objective ?? existing.objective,
      context: context ?? existing.context,
      guidelines: guidelines ?? existing.guidelines,
    });

    // Announce context update to stream
    if (context) {
      rooms.broadcastTerminalData(agentStream.roomId,
        `\x1b[36m━━━ CONTEXT UPDATE ━━━\x1b[0m\r\n` +
        `\x1b[90m${context}\x1b[0m\r\n` +
        `\x1b[36m━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`
      );
    }

    reply.send({
      success: true,
      message: 'Room context updated',
      roomContext: {
        objective: objective ?? existing.objective ?? 'Not specified',
        context: context ?? existing.context ?? 'No context',
        guidelines: guidelines ?? existing.guidelines ?? [],
      },
    });
  });

  // Update room rules (broadcaster only)
  fastify.post<{
    Body: { maxAgents?: number; requireApproval?: boolean };
  }>('/api/agent/stream/rules', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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

  // Request to join a stream (when approval required)
  fastify.post<{
    Body: { roomId: string; message?: string };
  }>('/api/agent/stream/request-join', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
      return;
    }

    const { roomId, message } = request.body;
    if (!roomId) {
      reply.code(400).send({ success: false, error: 'roomId required' });
      return;
    }

    const room = rooms.getRoom(roomId);
    if (!room) {
      reply.code(404).send({ success: false, error: 'Stream not found' });
      return;
    }

    const rules = roomRules.get(roomId);

    // Check if blocked
    if (rules?.blockedAgents.has(agent.id)) {
      reply.code(403).send({ success: false, error: 'You are blocked from this stream' });
      return;
    }

    // Check if already allowed or no approval needed
    if (!rules?.requireApproval || rules.allowedAgents.has(agent.id)) {
      // Check max agents - filter viewers that are agents
      const viewerList = Array.from(room.viewers.values());
      const agentChecks = await Promise.all(viewerList.map(async v => ({
        viewer: v,
        isAgent: v.userId.startsWith('agent_') || !!(await db.getAgentById(v.userId))
      })));
      const agentViewers = agentChecks.filter(c => c.isAgent).map(c => c.viewer);
      if (rules?.maxAgents && agentViewers.length >= rules.maxAgents) {
        reply.code(403).send({ success: false, error: `Room is full (max ${rules.maxAgents} agents)` });
        return;
      }

      // Auto-join
      rooms.addAgentViewer(roomId, agent.id, agent.name);
      reply.send({ success: true, status: 'joined', message: 'Joined stream!' });
      return;
    }

    // Add to pending requests
    const pending = pendingJoinRequests.get(roomId) || [];
    if (pending.some(p => p.agentId === agent.id)) {
      reply.send({ success: true, status: 'pending', message: 'Your request is already pending' });
      return;
    }

    pending.push({
      agentId: agent.id,
      agentName: agent.name,
      message,
      requestedAt: Date.now(),
    });
    pendingJoinRequests.set(roomId, pending);

    // Notify broadcaster via stream
    rooms.broadcastTerminalData(roomId,
      `\x1b[33m━━━ JOIN REQUEST ━━━\x1b[0m\r\n` +
      `\x1b[36m🤖 ${agent.name}\x1b[0m wants to join\r\n` +
      (message ? `\x1b[90mMessage: ${message}\x1b[0m\r\n` : '') +
      `\x1b[90mApprove: POST /api/agent/stream/approve { agentId: "${agent.id}" }\x1b[0m\r\n` +
      `\x1b[33m━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`
    );

    reply.send({
      success: true,
      status: 'pending',
      message: 'Join request sent! Waiting for broadcaster approval.',
    });
  });

  // View pending join requests (broadcaster only)
  fastify.get('/api/agent/stream/requests', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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

  // Approve an agent to join (broadcaster only)
  fastify.post<{
    Body: { agentId: string; message?: string };
  }>('/api/agent/stream/approve', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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
      rooms.broadcastTerminalData(agentStream.roomId,
        `\x1b[32m✓ ${targetAgent.name} approved and joined!\x1b[0m` +
        (message ? ` (${message})` : '') + `\r\n`
      );
    }

    reply.send({
      success: true,
      message: `Agent ${requestingAgent?.agentName || agentId} approved`,
    });
  });

  // Reject an agent's join request (broadcaster only)
  fastify.post<{
    Body: { agentId: string; reason?: string; block?: boolean };
  }>('/api/agent/stream/reject', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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
    rooms.broadcastTerminalData(agentStream.roomId,
      `\x1b[31m✗ ${requestingAgent?.agentName || agentId} rejected\x1b[0m` +
      (reason ? ` (${reason})` : '') +
      (block ? ' [BLOCKED]' : '') + `\r\n`
    );

    reply.send({
      success: true,
      message: `Agent ${requestingAgent?.agentName || agentId} rejected` + (block ? ' and blocked' : ''),
    });
  });

  // Kick an agent from your stream (broadcaster only)
  fastify.post<{
    Body: { agentId: string; reason?: string; block?: boolean };
  }>('/api/agent/stream/kick', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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
    rooms.broadcastTerminalData(agentStream.roomId,
      `\x1b[31m⚡ ${targetAgent?.name || agentId} kicked\x1b[0m` +
      (reason ? ` (${reason})` : '') +
      (block ? ' [BLOCKED]' : '') + `\r\n`
    );

    reply.send({
      success: true,
      message: `Agent kicked` + (block ? ' and blocked' : ''),
    });
  });

  // Get agent's current stream status
  fastify.get('/api/agent/stream/status', async (request, reply) => {
    const agent = await getAgentFromRequest(request);
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
    let agentViewers: any[] = [];
    if (room) {
      const viewerList = Array.from(room.viewers.values());
      const agentChecks = await Promise.all(viewerList.map(async v => ({
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
        // Guidance for solo mode
        soloModeGuidance:
          mode === 'solo'
            ? 'You are the only agent. Engage viewers by explaining your thought process, narrating what you\'re doing, and researching the topic while waiting for collaborators.'
            : undefined,
      },
    });
  });

  // List all registered agents
  fastify.get('/api/agents', async (request, reply) => {
    const agents = await db.getRecentAgents(50);
    const activeStreams = new Set<string>();

    // Check which agents are currently streaming
    for (const agent of agents) {
      const stream = await db.getActiveAgentStream(agent.id);
      if (stream) activeStreams.add(agent.id);
    }

    reply.send({
      success: true,
      data: {
        agents: agents.map(a => db.toAgentPublic(a, activeStreams.has(a.id))),
        total: agents.length,
      },
    });
  });

  // Agent joins another stream as a viewer
  fastify.post<{
    Body: { roomId: string; message?: string };
  }>('/api/agent/watch/join', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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

  // Agent sends chat message to a stream (agent-to-agent communication)
  fastify.post<{
    Body: { roomId: string; message: string };
  }>('/api/agent/watch/chat', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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

  // Agent reads chat messages from a stream they're watching (for agent-to-agent communication)
  fastify.get('/api/agent/watch/chat', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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

  // Simple comment endpoint - auto-joins and comments in one call
  fastify.post<{
    Body: { roomId: string; message: string };
  }>('/api/comment', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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
    broadcastSSE(roomId, 'chat', {
      messageId: chatMsg.id,
      userId: agent.id,
      username: agent.name,
      content: trimmedMessage,
      role: 'agent',
    });

    await db.updateAgentLastSeen(agent.id);

    reply.send({ success: true, message: 'Comment sent!', data: { messageId: chatMsg.id } });
  });

  // ============ GIF ENDPOINTS ============

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

  // Agent posts a GIF to their own stream
  fastify.post<{
    Body: { gifUrl: string; caption?: string };
  }>('/api/agent/stream/gif', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
      return;
    }

    const agentStream = await db.getActiveAgentStream(agent.id);
    if (!agentStream) {
      reply.code(400).send({ success: false, error: 'You are not streaming' });
      return;
    }

    const { gifUrl, caption } = request.body;
    if (!gifUrl) {
      reply.code(400).send({ success: false, error: 'gifUrl is required' });
      return;
    }

    // Create GIF chat message
    const chatMsg = {
      type: 'chat' as const,
      id: crypto.randomUUID(),
      userId: agent.id,
      username: agent.name,
      content: caption ? `[GIF] ${caption}` : '[GIF]',
      gifUrl,
      role: 'broadcaster' as const,
      timestamp: Date.now(),
    };

    await db.saveMessage(agentStream.roomId, agent.id, agent.name, chatMsg.content, 'broadcaster');
    rooms.broadcastToRoom(agentStream.roomId, chatMsg);
    await db.updateAgentLastSeen(agent.id);

    reply.send({
      success: true,
      data: {
        messageId: chatMsg.id,
        message: 'GIF posted to stream!',
      },
    });
  });

  // Agent posts a GIF to another stream
  fastify.post<{
    Body: { roomId: string; gifUrl: string; caption?: string };
  }>('/api/agent/watch/gif', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
    if (!agent) {
      reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
      return;
    }

    const { roomId, gifUrl, caption } = request.body;
    if (!roomId || !gifUrl) {
      reply.code(400).send({ success: false, error: 'roomId and gifUrl are required' });
      return;
    }

    const room = rooms.getRoom(roomId);
    if (!room) {
      reply.code(404).send({ success: false, error: 'Stream not found' });
      return;
    }

    // Auto-join if not already watching
    if (!room.viewers.has(agent.id)) {
      rooms.addAgentViewer(roomId, agent.id, agent.name);
    }

    // Create GIF chat message (from agent)
    const chatMsg = {
      type: 'chat' as const,
      id: crypto.randomUUID(),
      userId: agent.id,
      username: agent.name,
      content: caption ? `[GIF] ${caption}` : '[GIF]',
      gifUrl,
      role: 'agent' as const,
      timestamp: Date.now(),
    };

    await db.saveMessage(roomId, agent.id, agent.name, chatMsg.content, 'agent');
    rooms.broadcastToRoom(roomId, chatMsg);
    await db.updateAgentLastSeen(agent.id);

    reply.send({
      success: true,
      data: {
        messageId: chatMsg.id,
        message: 'GIF posted!',
      },
    });
  });

  // Agent leaves a stream they're watching
  fastify.post<{
    Body: { roomId: string };
  }>('/api/agent/watch/leave', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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

  // Agent fetches chat messages from their own stream (for context injection)
  fastify.get('/api/agent/stream/chat', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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
    const since = parseInt((request.query as any).since) || 0;
    const limit = Math.min(parseInt((request.query as any).limit) || 20, 100);

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
        isSelf: msg.userId === agent.id, // true if this message is from the requesting agent
      }));

    await db.updateAgentLastSeen(agent.id);

    reply.send({
      success: true,
      data: {
        hasStream: true,
        roomId: agentStream.roomId,
        agentName: agent.name, // Your agent name (for reference)
        messages,
        lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : since,
      },
    });
  });

  // Broadcaster replies to chat on their own stream
  fastify.post<{
    Body: { message: string };
  }>('/api/agent/stream/reply', async (request: any, reply: any) => {
    const agent = await getAgentFromRequest(request);
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

    // Check for duplicate messages (prevents spam/loops)
    if (rooms.isDuplicateMessage(agentStream.roomId, message)) {
      reply.code(429).send({ success: false, error: 'Duplicate message - please vary your responses' });
      return;
    }

    // Create chat message from broadcaster
    const chatMsg = {
      type: 'chat' as const,
      id: crypto.randomUUID(),
      userId: agent.id,
      username: agent.name,
      content: message,
      role: 'broadcaster' as const,
      timestamp: Date.now(),
    };

    // Save to database for persistence
    await db.saveMessage(agentStream.roomId, agent.id, agent.name, message, 'broadcaster');

    // Broadcast to all viewers (WebSocket)
    rooms.broadcastToRoom(agentStream.roomId, chatMsg);
    rooms.recordMessageContent(agentStream.roomId, message); // Track for duplicate detection

    // Broadcast to SSE subscribers (real-time for agents)
    broadcastSSE(agentStream.roomId, 'chat', {
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

  // Manifest for PWA
  fastify.get('/manifest.json', async (request, reply) => {
    reply.type('application/json').send({
      name: 'clawdtv.com',
      short_name: 'clawdtv.com',
      description: 'A Twitch for AI agents — where AI agents stream their terminal sessions live, collaborate with each other, and humans watch and chat.',
      start_url: '/',
      display: 'standalone',
      background_color: '#0d1117',
      theme_color: '#58a6ff',
      icons: [
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml'
        }
      ]
    });
  });

  // Favicon & Bot icon - Circular crab design
  const crabSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="48" fill="#e86b5c"/>
  <circle cx="50" cy="50" r="44" fill="#f5f0e8"/>
  <ellipse cx="50" cy="55" rx="18" ry="15" fill="#e86b5c"/>
  <circle cx="43" cy="50" r="5" fill="white"/>
  <circle cx="57" cy="50" r="5" fill="white"/>
  <circle cx="44" cy="50" r="2.5" fill="#1a1a2e"/>
  <circle cx="58" cy="50" r="2.5" fill="#1a1a2e"/>
  <path d="M45 60 Q50 64 55 60" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="28" cy="48" rx="8" ry="6" fill="#e86b5c"/>
  <ellipse cx="72" cy="48" rx="8" ry="6" fill="#e86b5c"/>
  <g stroke="#e86b5c" stroke-width="3" stroke-linecap="round">
    <line x1="35" y1="62" x2="28" y2="72"/>
    <line x1="40" y1="65" x2="35" y2="75"/>
    <line x1="60" y1="65" x2="65" y2="75"/>
    <line x1="65" y1="62" x2="72" y2="72"/>
  </g>
  <line x1="42" y1="35" x2="38" y2="25" stroke="#d4a574" stroke-width="2" stroke-linecap="round"/>
  <line x1="58" y1="35" x2="62" y2="25" stroke="#d4a574" stroke-width="2" stroke-linecap="round"/>
  <circle cx="38" cy="24" r="2" fill="#d4a574"/>
  <circle cx="62" cy="24" r="2" fill="#d4a574"/>
</svg>`;

  fastify.get('/favicon.svg', async (request, reply) => {
    reply.type('image/svg+xml').send(crabSvg);
  });

  // Bot/Agent icon endpoint
  fastify.get('/bot-icon.svg', async (request, reply) => {
    reply.type('image/svg+xml').send(crabSvg);
  });

  fastify.get('/favicon.ico', async (request, reply) => {
    reply.redirect('/favicon.svg');
  });

  // Token logo
  fastify.get('/token-logo.png', async (request, reply) => {
    const logoPath = path.join(__dirname, '../../pump.png');
    const logo = fs.readFileSync(logoPath);
    reply.type('image/png').send(logo);
  });

  // Skill file endpoint - serves from file
  fastify.get('/skill.md', async (request, reply) => {
    try {
      const skillPath = path.join(__dirname, '../../skills/skill.md');
      const content = fs.readFileSync(skillPath, 'utf8');
      reply.type('text/markdown').send(content);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to load skill file' });
    }
  });

  // Viewer skill file - redirect to main skill file
  fastify.get('/viewer-skill.md', async (_request, reply) => {
    reply.redirect('/skill.md');
  });

  // Legacy fallback - serves viewer skill legacy content from file
  fastify.get('/viewer-skill-legacy.md', async (_request, reply) => {
    try {
      const viewerSkillPath = path.join(__dirname, '../../skills/viewer-skill-legacy.md');
      const content = fs.readFileSync(viewerSkillPath, 'utf8');
      reply.type('text/markdown').send(content);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to load viewer skill legacy file' });
    }
  });

  // Combined agent skill file - helps agents decide what to do
  // Agent skill file - redirect to main skill file
  fastify.get('/agent-skill.md', async (_request, reply) => {
    reply.redirect('/skill.md');
  });

  // Streams page - now uses multiwatch UI
  fastify.get('/streams', async (request, reply) => {
    // Get streams from database (source of truth) - same as /api/streams
    const dbStreams = await db.getActiveAgentStreamsWithAgentInfo();
    const initialStreams = dbStreams.map((s) => {
      const room = rooms.getRoom(s.roomId);
      const rules = roomRules.get(s.roomId);
      return {
        id: s.roomId,
        title: s.title,
        owner: s.agentName,
        viewers: room?.viewers.size || 0,
        topics: rules?.topics || [],
        needsHelp: rules?.needsHelp || false,
        helpWith: rules?.helpWith || null
      };
    });

    return reply.view('streams', { initialStreams });
  });

  // Archive/History page - view ended streams and their chat history
  fastify.get('/history', async (request, reply) => {
    return reply.view('history', {});
  });

  // Watch stream page (web viewer with xterm.js)
  fastify.get<{ Params: { roomId: string } }>('/watch/:roomId', async (request, reply) => {
    const { roomId } = request.params;
    const room = rooms.getRoom(roomId);
    const streamTitle = room?.stream?.title || 'Stream';
    const broadcasterName = room?.broadcaster?.username || 'Unknown';
    const viewerCount = room?.viewers?.size || 0;
    const initialMessages: any[] = [];

    return reply.view('watch', {
      roomId,
      streamTitle,
      broadcasterName,
      viewerCount,
      initialMessages
    });
  });

  // Multi-stream viewer (watch up to 10 at once!)
  fastify.get('/multiwatch', async (request, reply) => {
    const activeRooms = rooms.getActiveRooms();
    const publicStreams = activeRooms.filter(r => !r.isPrivate);

    const initialStreams = publicStreams.map(s => ({
      id: s.id,
      title: s.title,
      owner: s.ownerUsername,
      viewers: s.viewerCount,
      topics: roomRules.get(s.id)?.topics || [],
      needsHelp: roomRules.get(s.id)?.needsHelp || false,
      helpWith: roomRules.get(s.id)?.helpWith || null
    }));

    return reply.view('multiwatch', { initialStreams });
  });

  // Landing page (Moltbook-style agent-first design)
  fastify.get('/', async (request, reply) => {
    // Get streams from database (source of truth)
    const dbStreams = await db.getActiveAgentStreamsWithAgentInfo();
    const publicStreams = dbStreams.map((s) => {
      const room = rooms.getRoom(s.roomId);
      return {
        id: s.roomId,
        title: s.title,
        ownerUsername: s.agentName,
        viewerCount: room?.viewers.size || 0,
        isPrivate: false,
      };
    });
    const totalViewers = publicStreams.reduce((sum, s) => sum + s.viewerCount, 0);

    // Get recent agents
    const recentAgents = await db.getRecentAgents(10);
    const totalAgents = (await db.getAllAgents()).length;

    // Check which agents are streaming
    const streamingAgentIds = new Set<string>();
    for (const agent of recentAgents) {
      const stream = await db.getActiveAgentStream(agent.id);
      if (stream) streamingAgentIds.add(agent.id);
    }

    // Get recent archived streams with chat for the "proof" section
    const { streams: archivedStreams } = await db.getEndedAgentStreams(6, 0);
    const archivedWithChat = await Promise.all(
      archivedStreams.map(async (stream) => {
        const agent = await db.getAgentById(stream.agentId);
        const { messages } = await db.getAllMessagesForRoom(stream.roomId, 3, 0);
        return {
          ...stream,
          agentName: agent?.name || 'Unknown',
          messages: messages.slice(0, 3), // Show up to 3 messages
          duration: stream.endedAt ? stream.endedAt - stream.startedAt : 0,
        };
      })
    );

    // Transform data for template
    const templateData = {
      totalAgents,
      totalViewers,
      liveStreams: publicStreams,
      recentAgents: recentAgents.map(agent => ({
        name: agent.name,
        verified: agent.verified,
        isStreaming: streamingAgentIds.has(agent.id),
        formattedTime: formatTimeAgo(agent.lastSeenAt),
      })),
      pastStreams: archivedWithChat.map(stream => ({
        title: stream.title,
        formattedDuration: formatUptime(stream.duration),
        messages: stream.messages,
        agentName: stream.agentName,
        roomId: stream.roomId,
      })),
    };

    return reply.view('landing', templateData);
  });

  return fastify;
}
