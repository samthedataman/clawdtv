"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApi = createApi;
const fastify_1 = __importDefault(require("fastify"));
function createApi(db, auth, rooms) {
    const fastify = (0, fastify_1.default)({ logger: false });
    // Auth middleware
    const authenticate = async (request, reply) => {
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
    fastify.post('/api/register', async (request, reply) => {
        const { username, password, displayName } = request.body;
        const result = await auth.register(username, password, displayName);
        if ('error' in result) {
            reply.code(400).send({ success: false, error: result.error });
            return;
        }
        reply.send({
            success: true,
            data: { token: result.token, user: result.user },
        });
    });
    // Login endpoint
    fastify.post('/api/login', async (request, reply) => {
        const { username, password } = request.body;
        const result = await auth.login(username, password);
        if ('error' in result) {
            reply.code(401).send({ success: false, error: result.error });
            return;
        }
        reply.send({
            success: true,
            data: { token: result.token, user: result.user },
        });
    });
    // List active streams
    fastify.get('/api/streams', async (request, reply) => {
        const activeRooms = rooms.getActiveRooms();
        const publicStreams = activeRooms.filter((r) => !r.isPrivate);
        reply.send({
            success: true,
            data: {
                streams: publicStreams.map((r) => ({
                    id: r.id,
                    ownerId: r.ownerId,
                    ownerUsername: r.ownerUsername,
                    title: r.title,
                    isPrivate: r.isPrivate,
                    hasPassword: r.hasPassword,
                    viewerCount: r.viewerCount,
                    startedAt: r.startedAt,
                })),
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
    // End stream (owner only)
    fastify.delete('/api/streams/:id', { preHandler: authenticate }, async (request, reply) => {
        const req = request;
        const { id } = req.params;
        const room = rooms.getRoom(id);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        if (room.stream.ownerId !== req.userId) {
            reply.code(403).send({ success: false, error: 'Forbidden' });
            return;
        }
        rooms.endRoom(id, 'ended');
        reply.send({ success: true });
    });
    // Get user profile
    fastify.get('/api/users/:id', async (request, reply) => {
        const { id } = request.params;
        const user = db.getUserById(id);
        if (!user) {
            reply.code(404).send({ success: false, error: 'User not found' });
            return;
        }
        reply.send({
            success: true,
            data: db.toUserPublic(user),
        });
    });
    // Update user profile
    fastify.put('/api/users/:id', { preHandler: authenticate }, async (request, reply) => {
        const req = request;
        const { id } = req.params;
        if (id !== req.userId) {
            reply.code(403).send({ success: false, error: 'Forbidden' });
            return;
        }
        const { displayName } = req.body;
        const updated = db.updateUser(id, { displayName });
        if (!updated) {
            reply.code(404).send({ success: false, error: 'User not found' });
            return;
        }
        const user = db.getUserById(id);
        reply.send({
            success: true,
            data: user ? db.toUserPublic(user) : null,
        });
    });
    // Health check
    fastify.get('/api/health', async (request, reply) => {
        reply.send({ success: true, data: { status: 'ok' } });
    });
    // Landing page
    fastify.get('/', async (request, reply) => {
        const activeRooms = rooms.getActiveRooms();
        const liveCount = activeRooms.filter(r => !r.isPrivate).length;
        const totalViewers = activeRooms.reduce((sum, r) => sum + r.viewerCount, 0);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>claude.tv - Terminal Streaming for Claude Code</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'SF Mono', 'Fira Code', monospace;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .logo {
      color: #58a6ff;
      font-size: 12px;
      line-height: 1.2;
      white-space: pre;
      margin-bottom: 20px;
    }
    .tagline {
      color: #8b949e;
      margin-bottom: 40px;
      font-size: 18px;
    }
    .stats {
      display: flex;
      gap: 40px;
      margin-bottom: 40px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 48px;
      color: #58a6ff;
      font-weight: bold;
    }
    .stat-label {
      color: #8b949e;
      font-size: 14px;
    }
    .section {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      width: 100%;
      margin-bottom: 20px;
    }
    h2 {
      color: #58a6ff;
      margin-bottom: 16px;
      font-size: 18px;
    }
    code {
      background: #0d1117;
      border: 1px solid #30363d;
      padding: 12px 16px;
      border-radius: 6px;
      display: block;
      margin: 8px 0;
      color: #7ee787;
    }
    .comment { color: #8b949e; }
    .live-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      background: #f85149;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <pre class="logo">
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗   ████████╗██╗   ██╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝   ╚══██╔══╝██║   ██║
██║     ██║     ███████║██║   ██║██║  ██║█████╗        ██║   ██║   ██║
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝        ██║   ╚██╗ ██╔╝
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗██╗   ██║    ╚████╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝     ╚═══╝
  </pre>
  <p class="tagline">Terminal Streaming for Claude Code</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-value"><span class="live-dot"></span>${liveCount}</div>
      <div class="stat-label">LIVE STREAMS</div>
    </div>
    <div class="stat">
      <div class="stat-value">${totalViewers}</div>
      <div class="stat-label">VIEWERS</div>
    </div>
  </div>

  <div class="section">
    <h2>🚀 Quick Start</h2>
    <code><span class="comment"># Install from GitHub</span><br>npm install -g github:samthedataman/claude-tv</code>
    <code><span class="comment"># Browse live streams</span><br>claude-tv</code>
    <code><span class="comment"># Start streaming your terminal</span><br>claude-tv stream "My Session"</code>
    <code><span class="comment"># Watch a specific stream</span><br>claude-tv watch &lt;room-id&gt;</code>
  </div>

  <div class="section">
    <h2>📺 Features</h2>
    <p>• Stream your Claude Code sessions live<br>
    • Twitch-style home screen with leaderboard<br>
    • Real-time chat with viewers<br>
    • Watch up to 10 streams simultaneously<br>
    • No login required - anonymous usernames</p>
  </div>

  <div class="section">
    <h2>📡 API</h2>
    <code>GET /api/streams <span class="comment"># List live streams</span></code>
    <code>GET /api/streams/:id <span class="comment"># Stream details</span></code>
  </div>

  <p style="margin-top: 20px; color: #8b949e;">
    <a href="https://github.com/samthedataman/claude-tv">GitHub</a> • Built for Claude Code
  </p>
</body>
</html>`;
        reply.type('text/html').send(html);
    });
    return fastify;
}
//# sourceMappingURL=api.js.map