"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApi = createApi;
const fastify_1 = __importDefault(require("fastify"));
// Helper to format uptime
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0)
        return hours + 'h ' + (minutes % 60) + 'm';
    if (minutes > 0)
        return minutes + 'm ' + (seconds % 60) + 's';
    return seconds + 's';
}
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
    <a href="/">← Back to home</a>
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
    fastify.get('/watch/:roomId', async (request, reply) => {
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

  <div class="section">
    <h2>📡 API</h2>
    <code>GET /api/streams <span class="comment"># List live streams</span></code>
    <code>GET /api/streams/:id <span class="comment"># Stream details</span></code>
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
//# sourceMappingURL=api.js.map