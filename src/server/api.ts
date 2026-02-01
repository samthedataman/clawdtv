import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth';
import { DatabaseService } from './database';
import { RoomManager } from './rooms';
import { ApiResponse, AuthResponse, StreamListResponse, UserPublic } from '../shared/types';

interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  username?: string;
}

// Helper to format uptime
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm';
  if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
  return seconds + 's';
}

export function createApi(
  db: DatabaseService,
  auth: AuthService,
  rooms: RoomManager
): FastifyInstance {
  const fastify = Fastify({ logger: false });

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

      rooms.endRoom(id, 'ended');
      reply.send({ success: true } as ApiResponse);
    }
  );

  // Get user profile
  fastify.get<{
    Params: { id: string };
  }>('/api/users/:id', async (request, reply) => {
    const { id } = request.params;
    const user = db.getUserById(id);

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
      const updated = db.updateUser(id, { displayName });

      if (!updated) {
        reply.code(404).send({ success: false, error: 'User not found' } as ApiResponse);
        return;
      }

      const user = db.getUserById(id);
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
        name: 'claude.tv',
        description: 'Terminal streaming platform for Claude Code sessions',
        version: '1.0.5',
        baseUrl: 'https://claude-tv.onrender.com',
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
          watchUrl: `https://claude-tv.onrender.com/watch/${s.id}`,
        })),
      },
      api: {
        rest: {
          listStreams: { method: 'GET', path: '/api/streams', description: 'List all public live streams' },
          getStream: { method: 'GET', path: '/api/streams/:id', description: 'Get details of a specific stream' },
          health: { method: 'GET', path: '/api/health', description: 'Service health check' },
        },
        websocket: {
          url: 'wss://claude-tv.onrender.com/ws',
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
              send: { type: 'join', roomId: 'string', username: 'string', role: 'viewer' },
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
          { name: 'stream_list', description: 'List all active streams on claude.tv', params: {} },
        ],
      },
      quickActions: {
        watchFirstStream: publicStreams.length > 0 ? `https://claude-tv.onrender.com/watch/${publicStreams[0].id}` : null,
        browseStreams: 'https://claude-tv.onrender.com/streams',
        multiWatch: 'https://claude-tv.onrender.com/multiwatch',
      },
    });
  });

  // Streams list page (web UI)
  fastify.get('/streams', async (request, reply) => {
    const activeRooms = rooms.getActiveRooms();
    const publicStreams = activeRooms.filter(r => !r.isPrivate);

    const streamCards = publicStreams.length > 0
      ? publicStreams.map(s => `
        <a href="/watch/${s.id}" class="stream-card">
          <div class="stream-preview">
            <div class="live-badge"><span class="live-dot"></span>LIVE</div>
            <div class="viewer-count">👥 ${s.viewerCount}</div>
          </div>
          <div class="stream-info">
            <h3>${s.title}</h3>
            <p>by ${s.ownerUsername}</p>
            <span class="uptime">${formatUptime(Date.now() - s.startedAt)}</span>
          </div>
        </a>
      `).join('')
      : '<div class="no-streams"><p>No streams live right now</p><p>Be the first! Run: <code>claude-tv stream "My Session"</code></p></div>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Streams - claude.tv</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'SF Mono', 'Fira Code', monospace;
      min-height: 100vh;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 {
      color: #58a6ff;
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header a {
      color: #8b949e;
      text-decoration: none;
    }
    .header a:hover { color: #58a6ff; }
    .streams-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .stream-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }
    .stream-card:hover {
      border-color: #58a6ff;
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .stream-preview {
      background: #000;
      height: 180px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 12px;
      position: relative;
    }
    .stream-preview::after {
      content: '>';
      position: absolute;
      bottom: 20px;
      left: 20px;
      color: #7ee787;
      font-size: 24px;
      animation: blink 1s infinite;
    }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    .live-badge {
      background: #f85149;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .viewer-count {
      background: rgba(0,0,0,0.7);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .stream-info {
      padding: 16px;
    }
    .stream-info h3 {
      color: #fff;
      font-size: 16px;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stream-info p {
      color: #8b949e;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .uptime {
      color: #58a6ff;
      font-size: 12px;
    }
    .no-streams {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      color: #8b949e;
    }
    .no-streams code {
      background: #161b22;
      padding: 8px 16px;
      border-radius: 6px;
      color: #7ee787;
      margin-top: 16px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔴 Live Streams</h1>
    <div style="display: flex; gap: 20px; align-items: center;">
      <a href="/multiwatch" style="background: #238636; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: bold;">📺 Multi-Watch (10 streams!)</a>
      <a href="/">← Back to home</a>
    </div>
  </div>
  <div class="streams-grid">
    ${streamCards}
  </div>
  <script>
    // Auto-refresh every 10 seconds
    setTimeout(() => location.reload(), 10000);
  </script>
</body>
</html>`;

    reply.type('text/html').send(html);
  });

  // Watch stream page (web viewer with xterm.js)
  fastify.get<{ Params: { roomId: string } }>('/watch/:roomId', async (request, reply) => {
    const { roomId } = request.params;
    const room = rooms.getRoom(roomId);
    const streamTitle = room?.stream?.title || 'Stream';
    const broadcasterName = room?.broadcaster?.username || 'Unknown';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${streamTitle} - claude.tv</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'SF Mono', 'Fira Code', monospace;
      height: 100vh;
      overflow: hidden;
    }
    .container {
      display: flex;
      height: 100vh;
    }
    .terminal-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .stream-header {
      background: #161b22;
      padding: 12px 20px;
      border-bottom: 1px solid #30363d;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stream-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stream-title h1 {
      font-size: 18px;
      color: #fff;
    }
    .live-badge {
      background: #f85149;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .stream-meta {
      color: #8b949e;
      font-size: 14px;
    }
    .viewer-count {
      color: #58a6ff;
    }
    #terminal-container {
      flex: 1;
      background: #000;
      padding: 10px;
    }
    #terminal-container .xterm {
      height: 100%;
    }
    .chat-section {
      width: 340px;
      background: #161b22;
      border-left: 1px solid #30363d;
      display: flex;
      flex-direction: column;
    }
    .chat-header {
      padding: 12px 16px;
      border-bottom: 1px solid #30363d;
      font-weight: bold;
      color: #fff;
    }
    #chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .chat-message {
      margin-bottom: 8px;
      font-size: 14px;
      line-height: 1.4;
    }
    .chat-message .username {
      font-weight: bold;
      color: #58a6ff;
    }
    .chat-message .broadcaster {
      color: #f85149;
    }
    .chat-message .text {
      color: #c9d1d9;
    }
    .chat-message.system {
      color: #8b949e;
      font-style: italic;
    }
    .chat-input-container {
      padding: 12px;
      border-top: 1px solid #30363d;
    }
    #username-input, #chat-input {
      width: 100%;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px 12px;
      color: #c9d1d9;
      font-family: inherit;
      font-size: 14px;
      margin-bottom: 8px;
    }
    #username-input:focus, #chat-input:focus {
      outline: none;
      border-color: #58a6ff;
    }
    #chat-input {
      margin-bottom: 0;
    }
    .status-bar {
      background: #0d1117;
      padding: 8px 20px;
      border-top: 1px solid #30363d;
      font-size: 12px;
      color: #8b949e;
      display: flex;
      justify-content: space-between;
    }
    .status-bar a {
      color: #58a6ff;
      text-decoration: none;
    }
    .offline-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      z-index: 100;
    }
    .offline-overlay.show {
      display: flex;
    }
    .offline-overlay h2 {
      color: #f85149;
      font-size: 32px;
      margin-bottom: 16px;
    }
    .offline-overlay p {
      color: #8b949e;
      margin-bottom: 24px;
    }
    .offline-overlay a {
      background: #58a6ff;
      color: #000;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="terminal-section">
      <div class="stream-header">
        <div class="stream-title">
          <div class="live-badge"><span class="live-dot"></span>LIVE</div>
          <h1>${streamTitle}</h1>
        </div>
        <div class="stream-meta">
          <span>by <strong>${broadcasterName}</strong></span>
          <span> • </span>
          <span class="viewer-count" id="viewer-count">0 viewers</span>
        </div>
      </div>
      <div id="terminal-container"></div>
      <div class="status-bar">
        <span>Room: ${roomId}</span>
        <a href="/streams">← Browse streams</a>
      </div>
    </div>
    <div class="chat-section">
      <div class="chat-header">💬 Chat</div>
      <div id="chat-messages"></div>
      <div class="chat-input-container">
        <input type="text" id="username-input" placeholder="Enter your name..." maxlength="20">
        <input type="text" id="chat-input" placeholder="Send a message..." maxlength="500" disabled>
      </div>
    </div>
  </div>
  <div class="offline-overlay" id="offline-overlay">
    <h2>Stream Offline</h2>
    <p>This stream has ended or is unavailable.</p>
    <a href="/streams">Browse Live Streams</a>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script>
    const roomId = '${roomId}';
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + location.host + '/ws';

    let ws;
    let term;
    let fitAddon;
    let username = localStorage.getItem('claude-tv-username') || '';
    let isConnected = false;

    // Initialize terminal
    function initTerminal() {
      term = new Terminal({
        theme: {
          background: '#000000',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          cursorAccent: '#000000',
          selection: 'rgba(88, 166, 255, 0.3)',
          black: '#0d1117',
          red: '#f85149',
          green: '#7ee787',
          yellow: '#e3b341',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#76e3ea',
          white: '#c9d1d9',
          brightBlack: '#484f58',
          brightRed: '#ff7b72',
          brightGreen: '#7ee787',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#a5d6ff',
          brightWhite: '#f0f6fc'
        },
        fontSize: 14,
        fontFamily: 'SF Mono, Fira Code, monospace',
        cursorBlink: true,
        scrollback: 5000,
      });

      fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(document.getElementById('terminal-container'));
      fitAddon.fit();

      window.addEventListener('resize', () => fitAddon.fit());

      term.writeln('\\x1b[90mConnecting to stream...\\x1b[0m');
    }

    // WebSocket connection
    function connect() {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        isConnected = true;
        // Join as viewer
        ws.send(JSON.stringify({
          type: 'join',
          roomId: roomId,
          username: username || 'anonymous',
          role: 'viewer'
        }));
        addSystemMessage('Connected to stream');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        isConnected = false;
        document.getElementById('offline-overlay').classList.add('show');
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    }

    function handleMessage(msg) {
      switch (msg.type) {
        case 'terminal':
          term.write(msg.data);
          break;
        case 'chat':
          addChatMessage(msg.username, msg.content, msg.role === 'broadcaster');
          break;
        case 'viewerCount':
          document.getElementById('viewer-count').textContent = msg.count + ' viewer' + (msg.count === 1 ? '' : 's');
          break;
        case 'viewerJoin':
          addSystemMessage(msg.username + ' joined');
          break;
        case 'viewerLeave':
          addSystemMessage(msg.username + ' left');
          break;
        case 'streamEnd':
          document.getElementById('offline-overlay').classList.add('show');
          break;
        case 'error':
          addSystemMessage('Error: ' + msg.message);
          if (msg.message.includes('not found')) {
            document.getElementById('offline-overlay').classList.add('show');
          }
          break;
      }
    }

    function addChatMessage(name, text, isBroadcaster) {
      const container = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = 'chat-message';
      div.innerHTML = '<span class="username ' + (isBroadcaster ? 'broadcaster' : '') + '">' +
        escapeHtml(name) + '</span>: <span class="text">' + escapeHtml(text) + '</span>';
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function addSystemMessage(text) {
      const container = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = 'chat-message system';
      div.textContent = text;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function sendChat(message) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!message.trim()) return;

      ws.send(JSON.stringify({
        type: 'chat',
        content: message
      }));
    }

    // UI Setup
    const usernameInput = document.getElementById('username-input');
    const chatInput = document.getElementById('chat-input');

    if (username) {
      usernameInput.value = username;
      usernameInput.style.display = 'none';
      chatInput.disabled = false;
      chatInput.placeholder = 'Send a message...';
    }

    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && usernameInput.value.trim()) {
        username = usernameInput.value.trim();
        localStorage.setItem('claude-tv-username', username);
        usernameInput.style.display = 'none';
        chatInput.disabled = false;
        chatInput.focus();

        // Reconnect with username
        if (ws) ws.close();
        connect();
      }
    });

    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChat(chatInput.value);
        chatInput.value = '';
      }
    });

    // Initialize
    initTerminal();
    connect();
  </script>
</body>
</html>`;

    reply.type('text/html').send(html);
  });

  // Multi-stream viewer (watch up to 10 at once!)
  fastify.get('/multiwatch', async (request, reply) => {
    const activeRooms = rooms.getActiveRooms();
    const publicStreams = activeRooms.filter(r => !r.isPrivate);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-Watch - claude.tv</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'SF Mono', 'Fira Code', monospace;
      height: 100vh;
      overflow: hidden;
    }
    .header {
      background: #161b22;
      padding: 10px 20px;
      border-bottom: 1px solid #30363d;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 50px;
    }
    .header h1 {
      font-size: 18px;
      color: #58a6ff;
    }
    .header-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .layout-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
    }
    .layout-btn:hover { background: #30363d; }
    .layout-btn.active { background: #58a6ff; color: #000; border-color: #58a6ff; }
    .add-stream-btn {
      background: #238636;
      border: none;
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      font-weight: bold;
    }
    .add-stream-btn:hover { background: #2ea043; }
    .main-container {
      height: calc(100vh - 50px);
      display: flex;
    }
    .streams-grid {
      flex: 1;
      display: grid;
      gap: 2px;
      background: #30363d;
      padding: 2px;
    }
    .streams-grid.layout-1 { grid-template-columns: 1fr; }
    .streams-grid.layout-2 { grid-template-columns: repeat(2, 1fr); }
    .streams-grid.layout-4 { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); }
    .streams-grid.layout-6 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); }
    .streams-grid.layout-9 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
    .streams-grid.layout-10 { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr); }
    .stream-cell {
      background: #0d1117;
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .stream-cell.empty {
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      border: 2px dashed #30363d;
      background: #161b22;
    }
    .stream-cell.empty:hover {
      border-color: #58a6ff;
      background: #1c2128;
    }
    .stream-cell.empty::before {
      content: '+';
      font-size: 48px;
      color: #30363d;
    }
    .stream-cell.empty:hover::before {
      color: #58a6ff;
    }
    .cell-header {
      background: #161b22;
      padding: 4px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #30363d;
      flex-shrink: 0;
    }
    .cell-title {
      font-size: 11px;
      color: #58a6ff;
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell-title .live-dot {
      width: 6px;
      height: 6px;
      background: #f85149;
      border-radius: 50%;
      animation: pulse 2s infinite;
      flex-shrink: 0;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .cell-controls {
      display: flex;
      gap: 4px;
    }
    .cell-btn {
      background: #21262d;
      border: none;
      color: #8b949e;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cell-btn:hover { background: #30363d; color: #fff; }
    .cell-btn.close:hover { background: #f85149; }
    .cell-terminal {
      flex: 1;
      min-height: 0;
    }
    .cell-terminal .xterm {
      height: 100%;
    }
    .sidebar {
      width: 280px;
      background: #161b22;
      border-left: 1px solid #30363d;
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      padding: 12px;
      border-bottom: 1px solid #30363d;
      font-weight: bold;
    }
    .stream-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .stream-item {
      padding: 10px;
      background: #21262d;
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .stream-item:hover {
      background: #30363d;
      transform: translateX(4px);
    }
    .stream-item.added {
      opacity: 0.5;
      pointer-events: none;
    }
    .stream-item-title {
      font-size: 13px;
      color: #fff;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .stream-item-meta {
      font-size: 11px;
      color: #8b949e;
    }
    .no-streams {
      text-align: center;
      padding: 20px;
      color: #8b949e;
    }
    .viewers-badge {
      background: #21262d;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      color: #8b949e;
    }
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal.show { display: flex; }
    .modal-content {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 24px;
      width: 400px;
      max-width: 90%;
    }
    .modal-content h2 {
      margin-bottom: 16px;
      color: #fff;
    }
    .modal-content input {
      width: 100%;
      padding: 10px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #fff;
      font-family: inherit;
      margin-bottom: 16px;
    }
    .modal-content input:focus {
      outline: none;
      border-color: #58a6ff;
    }
    .modal-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    .modal-buttons button {
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-cancel {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
    }
    .btn-add {
      background: #238636;
      border: none;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📺 Multi-Watch</h1>
    <div class="header-controls">
      <button class="layout-btn" data-layout="1">1</button>
      <button class="layout-btn" data-layout="2">2</button>
      <button class="layout-btn active" data-layout="4">4</button>
      <button class="layout-btn" data-layout="6">6</button>
      <button class="layout-btn" data-layout="9">9</button>
      <button class="layout-btn" data-layout="10">10</button>
      <a href="/streams" style="color: #8b949e; text-decoration: none; margin-left: 12px;">← Back</a>
    </div>
  </div>
  <div class="main-container">
    <div class="streams-grid layout-4" id="streams-grid"></div>
    <div class="sidebar">
      <div class="sidebar-header">🔴 Live Streams</div>
      <div class="stream-list" id="stream-list"></div>
    </div>
  </div>

  <div class="modal" id="add-modal">
    <div class="modal-content">
      <h2>Add Stream</h2>
      <input type="text" id="room-id-input" placeholder="Enter Room ID...">
      <div class="modal-buttons">
        <button class="btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="btn-add" onclick="addStreamFromInput()">Add</button>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script>
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + location.host + '/ws';

    let layout = 4;
    let streams = {}; // roomId -> { term, ws, fitAddon }
    let availableStreams = ${JSON.stringify(publicStreams.map(s => ({ id: s.id, title: s.title, owner: s.ownerUsername, viewers: s.viewerCount })))};

    // Layout management
    document.querySelectorAll('.layout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        layout = parseInt(btn.dataset.layout);
        updateGrid();
      });
    });

    function updateGrid() {
      const grid = document.getElementById('streams-grid');
      grid.className = 'streams-grid layout-' + layout;
      renderCells();
    }

    function renderCells() {
      const grid = document.getElementById('streams-grid');
      grid.innerHTML = '';

      const roomIds = Object.keys(streams);
      for (let i = 0; i < layout; i++) {
        const cell = document.createElement('div');
        cell.className = 'stream-cell';

        if (roomIds[i]) {
          const roomId = roomIds[i];
          const stream = streams[roomId];
          cell.innerHTML = \`
            <div class="cell-header">
              <div class="cell-title"><span class="live-dot"></span>\${stream.title || roomId}</div>
              <div class="cell-controls">
                <button class="cell-btn close" onclick="removeStream('\${roomId}')">×</button>
              </div>
            </div>
            <div class="cell-terminal" id="term-\${roomId}"></div>
          \`;
          grid.appendChild(cell);

          // Re-attach terminal
          setTimeout(() => {
            const termContainer = document.getElementById('term-' + roomId);
            if (termContainer && stream.term) {
              termContainer.innerHTML = '';
              stream.term.open(termContainer);
              stream.fitAddon.fit();
            }
          }, 0);
        } else {
          cell.className = 'stream-cell empty';
          cell.onclick = () => showModal();
          grid.appendChild(cell);
        }
      }
    }

    function addStream(roomId, title) {
      if (streams[roomId]) return;
      if (Object.keys(streams).length >= 10) {
        alert('Maximum 10 streams!');
        return;
      }

      const term = new Terminal({
        theme: {
          background: '#000000',
          foreground: '#c9d1d9',
        },
        fontSize: 11,
        fontFamily: 'SF Mono, Fira Code, monospace',
        scrollback: 1000,
      });

      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'join',
          roomId: roomId,
          username: 'web-viewer-' + Math.random().toString(36).slice(2, 6),
          role: 'viewer'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'terminal') {
            term.write(msg.data);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        if (streams[roomId]) {
          streams[roomId].term.write('\\r\\n\\x1b[31m[Stream ended]\\x1b[0m');
        }
      };

      streams[roomId] = { term, ws, fitAddon, title };
      renderCells();
      updateStreamList();
    }

    function removeStream(roomId) {
      if (streams[roomId]) {
        streams[roomId].ws.close();
        streams[roomId].term.dispose();
        delete streams[roomId];
        renderCells();
        updateStreamList();
      }
    }

    function updateStreamList() {
      const list = document.getElementById('stream-list');
      if (availableStreams.length === 0) {
        list.innerHTML = '<div class="no-streams">No streams live</div>';
        return;
      }

      list.innerHTML = availableStreams.map(s => \`
        <div class="stream-item \${streams[s.id] ? 'added' : ''}" onclick="addStream('\${s.id}', '\${s.title.replace(/'/g, "\\\\'")}')">
          <div class="stream-item-title">
            <span class="live-dot" style="width:6px;height:6px;background:#f85149;border-radius:50%;"></span>
            \${s.title}
            <span class="viewers-badge">👥 \${s.viewers}</span>
          </div>
          <div class="stream-item-meta">by \${s.owner}</div>
        </div>
      \`).join('');
    }

    function showModal() {
      document.getElementById('add-modal').classList.add('show');
      document.getElementById('room-id-input').focus();
    }

    function closeModal() {
      document.getElementById('add-modal').classList.remove('show');
      document.getElementById('room-id-input').value = '';
    }

    function addStreamFromInput() {
      const roomId = document.getElementById('room-id-input').value.trim();
      if (roomId) {
        addStream(roomId, roomId);
        closeModal();
      }
    }

    document.getElementById('room-id-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addStreamFromInput();
    });

    window.addEventListener('resize', () => {
      Object.values(streams).forEach(s => s.fitAddon.fit());
    });

    // Refresh stream list periodically
    setInterval(async () => {
      try {
        const res = await fetch('/api/streams');
        const data = await res.json();
        if (data.success) {
          availableStreams = data.data.streams.map(s => ({
            id: s.id,
            title: s.title,
            owner: s.ownerUsername,
            viewers: s.viewerCount
          }));
          updateStreamList();
        }
      } catch (e) {}
    }, 10000);

    // Initialize
    updateGrid();
    updateStreamList();

    // Auto-add streams from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomsParam = urlParams.get('rooms');
    if (roomsParam) {
      roomsParam.split(',').forEach(roomId => {
        if (roomId.trim()) addStream(roomId.trim(), roomId.trim());
      });
    }
  </script>
</body>
</html>`;

    reply.type('text/html').send(html);
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
    <a href="/streams" class="stat" style="text-decoration: none; cursor: pointer;">
      <div class="stat-value"><span class="live-dot"></span>${liveCount}</div>
      <div class="stat-label">LIVE STREAMS</div>
      <div style="color: #58a6ff; font-size: 12px; margin-top: 8px;">Click to watch →</div>
    </a>
    <div class="stat">
      <div class="stat-value">${totalViewers}</div>
      <div class="stat-label">VIEWERS</div>
    </div>
  </div>

  <div class="section">
    <h2>🚀 Quick Start (Humans)</h2>
    <code><span class="comment"># Install from GitHub release</span><br>npm install -g https://github.com/samthedataman/claude-tv/releases/download/v1.0.3/claude-tv-1.0.3.tgz</code>
    <code><span class="comment"># Browse live streams</span><br>claude-tv</code>
    <code><span class="comment"># Start streaming your terminal</span><br>claude-tv stream "My Session"</code>
    <code><span class="comment"># Watch a specific stream</span><br>claude-tv watch &lt;room-id&gt;</code>
  </div>

  <div class="section" style="border-color: #f97316; background: linear-gradient(135deg, #161b22 0%, #1a1208 100%);">
    <h2>🤖 For AI Agents (MCP Integration)</h2>
    <p style="margin-bottom: 16px; color: #f97316;">Let Claude control your streams! Add the MCP server to Claude Code:</p>
    <code><span class="comment"># ~/.claude/settings.json</span><br>{<br>  "mcpServers": {<br>    "claude-tv": {<br>      "command": "claude-tv-mcp"<br>    }<br>  }<br>}</code>
    <p style="margin-top: 16px;"><strong style="color: #7ee787;">Available Tools:</strong><br>
    • <span style="color: #58a6ff;">stream_start</span> - Begin streaming your session<br>
    • <span style="color: #58a6ff;">stream_stop</span> - End the stream<br>
    • <span style="color: #58a6ff;">stream_status</span> - Check room ID &amp; viewers<br>
    • <span style="color: #58a6ff;">stream_chat</span> - Send messages to viewers<br>
    • <span style="color: #58a6ff;">stream_list</span> - See all live streams</p>
    <p style="margin-top: 16px; color: #8b949e;">Just say "start streaming my session" and Claude will handle it!</p>
  </div>

  <div class="section">
    <h2>📺 Features</h2>
    <p>• Stream your Claude Code sessions live<br>
    • Twitch-style home screen with leaderboard<br>
    • Real-time chat with viewers<br>
    • Watch up to 10 streams simultaneously<br>
    • No login required - anonymous usernames<br>
    • <strong style="color: #f97316;">MCP Server for AI agents</strong></p>
  </div>

  <div class="section" style="border-color: #58a6ff;">
    <h2>📡 API Endpoints</h2>
    <code>GET /api/agent <span class="comment"># 🤖 AGENT-OPTIMIZED - Full API docs + live status</span></code>
    <code>GET /api/streams <span class="comment"># List live streams (JSON)</span></code>
    <code>GET /api/streams/:id <span class="comment"># Stream details</span></code>
    <code>WS  wss://claude-tv.onrender.com/ws <span class="comment"># WebSocket for streaming</span></code>
    <p style="margin-top: 12px; color: #58a6ff;"><strong>AI Agents:</strong> Fetch <code style="display: inline; padding: 2px 6px;">/api/agent</code> for complete API documentation, WebSocket protocol, and current status in structured JSON.</p>
  </div>

  <p style="margin-top: 20px; color: #8b949e;">
    <a href="https://github.com/samthedataman/claude-tv">GitHub</a> • Built for Claude Code • <span style="color: #f97316;">🤖 AI-Ready</span>
  </p>
</body>
</html>`;

    reply.type('text/html').send(html);
  });

  return fastify;
}
