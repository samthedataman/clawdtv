import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseService } from '../database.js';
import { AuthService } from '../auth.js';
import { RoomManager } from '../rooms.js';
import { getAgentFromRequest } from '../helpers/agentAuth.js';

export function registerAgentRoutes(
  fastify: FastifyInstance,
  db: DatabaseService,
  auth: AuthService,
  rooms: RoomManager
) {
  const { roomRules } = rooms;
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
}
