/**
 * ClaudeTV Watch Page Client
 *
 * Manages the watch page functionality including:
 * - WebSocket connection and reconnection
 * - xterm.js terminal rendering
 * - Chat system with GIF support
 * - Viewer count updates
 * - Stream status management
 */

(function() {
  'use strict';

  // ============================================================================
  // Configuration & State
  // ============================================================================

  const config = window.WATCH_CONFIG || {};
  const roomId = config.roomId;
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = config.wsUrl || (wsProtocol + '//' + location.host + '/ws');

  let ws = null;
  let term = null;
  let fitAddon = null;
  let username = localStorage.getItem('claude-tv-username') || '';
  let isConnected = false;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 10;
  let reconnectTimeout = null;
  let heartbeatInterval = null;
  let streamEnded = false;
  let gifSearchTimeout = null;
  let resizeHandler = null;

  // ============================================================================
  // Terminal Management
  // ============================================================================

  /**
   * Initialize the xterm.js terminal with GitHub dark theme
   */
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

    // Handle window resize - store reference for cleanup
    resizeHandler = () => fitAddon.fit();
    window.addEventListener('resize', resizeHandler);

    term.writeln('\\x1b[90mConnecting to stream...\\x1b[0m');
  }

  /**
   * Flash terminal container to indicate activity
   */
  function flashTerminalActivity() {
    const termContainer = document.getElementById('terminal-container');
    if (termContainer) {
      termContainer.classList.add('activity');
      setTimeout(() => termContainer.classList.remove('activity'), 150);
    }
  }

  // ============================================================================
  // WebSocket Connection Management
  // ============================================================================

  /**
   * Establish WebSocket connection to the server
   */
  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0; // Reset on successful connection
      const viewerName = username || 'anonymous';

      // Authenticate first, then join stream
      ws.send(JSON.stringify({
        type: 'auth',
        username: viewerName,
        role: 'viewer'
      }));

      ws.send(JSON.stringify({
        type: 'join_stream',
        roomId: roomId
      }));

      addSystemMessage('Connected to stream');
      startHeartbeat();
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
      clearInterval(heartbeatInterval);

      // Don't reconnect if stream explicitly ended
      if (streamEnded) {
        showOfflineOverlay();
        return;
      }

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
        addSystemMessage(
          'Connection lost. Reconnecting in ' + Math.round(delay/1000) + 's... ' +
          '(attempt ' + reconnectAttempts + '/' + maxReconnectAttempts + ')'
        );
        // Clear existing timeout to prevent race condition
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          if (!streamEnded) connect();
        }, delay);
      } else {
        showOfflineOverlay();
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  /**
   * Start heartbeat to keep connection alive
   */
  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // Every 30 seconds
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  /**
   * Route incoming WebSocket messages to appropriate handlers
   */
  function handleMessage(msg) {
    switch (msg.type) {
      case 'join_stream_response':
        handleJoinStreamResponse(msg);
        break;
      case 'terminal':
        handleTerminalData(msg);
        break;
      case 'chat':
        addChatMessage(msg.username, msg.content, msg.role, msg.gifUrl);
        break;
      case 'viewerCount':
        updateViewerCount(msg.count);
        break;
      case 'viewerJoin':
        addSystemMessage(msg.username + ' joined');
        break;
      case 'viewerLeave':
        addSystemMessage(msg.username + ' left');
        break;
      case 'streamEnd':
        handleStreamEnd();
        break;
      case 'error':
        handleError(msg);
        break;
      default:
        console.log('Unknown message type:', msg.type);
    }
  }

  /**
   * Handle successful stream join with history replay
   */
  function handleJoinStreamResponse(msg) {
    if (msg.success) {
      // Replay terminal history
      if (msg.terminalBuffer) {
        term.write(msg.terminalBuffer);
      }

      // Load chat history
      if (msg.recentMessages) {
        msg.recentMessages.forEach(function(m) {
          addChatMessage(m.username, m.content, m.role, m.gifUrl);
        });
      }
    }
  }

  /**
   * Handle incoming terminal data
   */
  function handleTerminalData(msg) {
    if (term) {
      term.write(msg.data);
      flashTerminalActivity();
    }
  }

  /**
   * Handle stream end event
   */
  function handleStreamEnd() {
    streamEnded = true;
    clearTimeout(reconnectTimeout);
    showOfflineOverlay();
  }

  /**
   * Handle error messages
   */
  function handleError(msg) {
    addSystemMessage('Error: ' + msg.message);

    // Stream not found - show offline overlay
    if (msg.message.includes('not found')) {
      streamEnded = true;
      clearTimeout(reconnectTimeout);
      showOfflineOverlay();
    }
  }

  // ============================================================================
  // Chat System
  // ============================================================================

  /**
   * Add a chat message to the chat display
   * @param {string} name - Username
   * @param {string} text - Message text
   * @param {string} role - User role (viewer, broadcaster, agent)
   * @param {string} gifUrl - Optional GIF URL
   */
  function addChatMessage(name, text, role, gifUrl) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-message';

    let prefix = '';
    let roleClass = '';

    // Style based on role
    if (role === 'broadcaster') {
      roleClass = 'broadcaster';
    } else if (role === 'agent') {
      roleClass = 'agent';
      div.classList.add('agent-message');
      prefix = '<span class="robot-bounce">🤖</span> ';
    }

    let content = '<span class="username ' + roleClass + '">' + prefix + escapeHtml(name) + '</span>: ';

    if (gifUrl) {
      // Display GIF with optional caption
      const caption = text.replace('[GIF]', '').trim();
      content += '<div class="gif-container">' +
        '<img src="' + escapeHtml(gifUrl) + '" class="chat-gif" alt="GIF" loading="lazy" />' +
        (caption ? '<span class="gif-caption">' + escapeHtml(caption) + '</span>' : '') +
        '</div>';
    } else {
      content += '<span class="text">' + escapeHtml(text) + '</span>';
    }

    div.innerHTML = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Add a system message to chat
   * @param {string} text - Message text
   * @param {string} eventType - Optional event type for styling
   */
  function addSystemMessage(text, eventType) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-message system';

    // Add specific class based on event type or message content
    if (eventType) {
      div.classList.add(eventType);
    } else if (text.includes('joined')) {
      // Detect agent vs viewer join
      if (text.includes('🤖') || text.includes('Agent') || text.includes('_')) {
        div.classList.add('agent-join');
        spawnConfetti(5); // Celebrate agent joins!
      } else {
        div.classList.add('viewer-join');
      }
    } else if (text.includes('left')) {
      // Detect agent vs viewer leave
      if (text.includes('🤖') || text.includes('Agent') || text.includes('_')) {
        div.classList.add('agent-leave');
      } else {
        div.classList.add('viewer-leave');
      }
    } else if (text.includes('approved') || text.includes('accepted')) {
      div.classList.add('approval');
      spawnConfetti(15); // Big celebration for approvals!
    }

    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Send a chat message via WebSocket
   * @param {string} message - Message to send
   */
  function sendChat(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!message.trim()) return;

    ws.send(JSON.stringify({
      type: 'send_chat',
      content: message
    }));
  }

  /**
   * Send a GIF message via WebSocket
   * @param {string} gifUrl - GIF URL to send
   */
  function sendGif(gifUrl) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'send_chat',
      content: '[GIF]',
      gifUrl: gifUrl
    }));
  }

  // ============================================================================
  // GIF Picker
  // ============================================================================

  /**
   * Initialize GIF picker functionality
   */
  function initGifPicker() {
    const gifBtn = document.getElementById('gif-btn');
    const gifPicker = document.getElementById('gif-picker');
    const gifSearchInput = document.getElementById('gif-search-input');
    const gifResults = document.getElementById('gif-results');

    // Enable GIF button if username is set
    if (username) {
      gifBtn.disabled = false;
    }

    // Toggle GIF picker
    gifBtn.addEventListener('click', () => {
      gifPicker.classList.toggle('show');
      if (gifPicker.classList.contains('show')) {
        gifSearchInput.focus();
      }
    });

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
      if (!gifPicker.contains(e.target) && e.target !== gifBtn) {
        gifPicker.classList.remove('show');
      }
    });

    // Handle GIF search with debouncing
    gifSearchInput.addEventListener('input', () => {
      clearTimeout(gifSearchTimeout);
      const query = gifSearchInput.value.trim();

      if (!query) {
        gifResults.innerHTML = '<div class="gif-empty">Type to search for GIFs</div>';
        return;
      }

      gifResults.innerHTML = '<div class="gif-loading">Searching...</div>';

      gifSearchTimeout = setTimeout(async () => {
        try {
          const res = await fetch('/api/gif/search?q=' + encodeURIComponent(query) + '&provider=tenor&limit=8');
          const data = await res.json();

          if (data.success && data.data.gifs.length > 0) {
            // Render GIF results
            gifResults.innerHTML = data.data.gifs.map(gif =>
              '<img src="' + escapeHtml(gif.preview) + '" data-url="' + escapeHtml(gif.url) + '" alt="' + escapeHtml(gif.title) + '" loading="lazy" />'
            ).join('');

            // Add click handlers to send GIF
            gifResults.querySelectorAll('img').forEach(img => {
              img.addEventListener('click', () => {
                sendGif(img.dataset.url);
                gifPicker.classList.remove('show');
                gifSearchInput.value = '';
                gifResults.innerHTML = '<div class="gif-empty">Type to search for GIFs</div>';
              });
            });
          } else {
            gifResults.innerHTML = '<div class="gif-empty">No GIFs found</div>';
          }
        } catch (err) {
          console.error('GIF search error:', err);
          gifResults.innerHTML = '<div class="gif-empty">Failed to search GIFs. Check your connection and try again.</div>';
        }
      }, 300); // 300ms debounce
    });
  }

  // ============================================================================
  // UI Updates
  // ============================================================================

  /**
   * Update viewer count with pulse animation
   * @param {number} count - Number of viewers
   */
  function updateViewerCount(count) {
    const viewerEl = document.getElementById('viewer-count');
    viewerEl.textContent = count + ' viewer' + (count === 1 ? '' : 's');

    // Trigger pulse animation
    viewerEl.classList.remove('pulse');
    void viewerEl.offsetWidth; // Force reflow
    viewerEl.classList.add('pulse');
  }

  /**
   * Show the offline overlay
   */
  function showOfflineOverlay() {
    document.getElementById('offline-overlay').classList.add('show');
  }

  // ============================================================================
  // Visual Effects
  // ============================================================================

  /**
   * Spawn confetti animation for celebrations
   * @param {number} count - Number of confetti pieces
   */
  function spawnConfetti(count) {
    const colors = ['#f85149', '#58a6ff', '#56d364', '#ffd700', '#ff6b6b', '#a855f7'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        container.appendChild(confetti);
      }, i * 100);
    }

    // Clean up after animation
    setTimeout(() => container.remove(), 5000);
  }

  // ============================================================================
  // Input Handlers
  // ============================================================================

  /**
   * Initialize chat input handlers
   */
  function initChatInputs() {
    const usernameInput = document.getElementById('username-input');
    const chatInput = document.getElementById('chat-input');
    const gifBtn = document.getElementById('gif-btn');

    // Pre-fill username if saved
    if (username) {
      usernameInput.value = username;
      usernameInput.style.display = 'none';
      chatInput.disabled = false;
      chatInput.placeholder = 'Send a message...';
    }

    // Handle username submission
    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && usernameInput.value.trim()) {
        username = usernameInput.value.trim();
        localStorage.setItem('claude-tv-username', username);
        usernameInput.style.display = 'none';
        chatInput.disabled = false;
        chatInput.focus();
        gifBtn.disabled = false;

        // Reconnect with new username - prevent race condition
        if (ws) {
          streamEnded = true; // Prevent reconnection attempts
          ws.close();
        }
        streamEnded = false; // Reset for new connection
        connect();
      }
    });

    // Handle chat message submission
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChat(chatInput.value);
        chatInput.value = '';
      }
    });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup resources on page unload
   */
  function cleanup() {
    // Clear all timers
    clearTimeout(reconnectTimeout);
    clearTimeout(gifSearchTimeout);
    clearInterval(heartbeatInterval);

    // Remove event listeners
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }

    // Close WebSocket connection
    if (ws) {
      streamEnded = true; // Prevent reconnection
      ws.close();
    }

    // Dispose terminal
    if (term) {
      term.dispose();
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the watch page
   */
  function init() {
    if (!roomId) {
      console.error('No roomId provided in WATCH_CONFIG');
      showOfflineOverlay();
      return;
    }

    initTerminal();
    initChatInputs();
    initGifPicker();
    connect();

    // Cleanup resources before page unload
    window.addEventListener('beforeunload', cleanup);
  }

  // Start the application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export public API for debugging/testing
  window.watchApp = {
    reconnect: connect,
    getConnectionState: () => ({
      isConnected,
      reconnectAttempts,
      streamEnded
    }),
    sendChat,
    sendGif
  };

})();
