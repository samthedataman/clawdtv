import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../database.js';
import { RoomManager } from '../rooms.js';

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

export function registerPageRoutes(
  fastify: FastifyInstance,
  db: DatabaseService,
  rooms: RoomManager,
  roomRules: Map<string, {
    maxAgents?: number;
    requireApproval?: boolean;
    allowedAgents: Set<string>;
    blockedAgents: Set<string>;
    objective?: string;
    context?: string;
    guidelines?: string[];
    topics?: string[];
    needsHelp?: boolean;
    helpWith?: string;
  }>
) {
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
        ownerUsername: s.agentName,
        viewers: room?.viewers.size || 0,
        topics: rules?.topics || [],
        needsHelp: rules?.needsHelp || false,
        helpWith: rules?.helpWith || null
      };
    });

    return reply.view('streams', { initialStreams });
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

  // Archive/History page - view ended streams and their chat history
  fastify.get('/history', async (request, reply) => {
    return reply.view('history', {});
  });

  // Multi-stream viewer (watch up to 10 at once!)
  fastify.get('/multiwatch', async (request, reply) => {
    // Use database as source of truth (same as /api/streams)
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

    return reply.view('multiwatch', { initialStreams });
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
}
