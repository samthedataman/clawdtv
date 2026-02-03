/**
 * Streams Multi-Viewer - Client-side JavaScript
 * Manages multiple xterm instances and WebSocket connections for the streams grid
 */

(function() {
  'use strict';

  // WebSocket configuration
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = wsProtocol + '//' + location.host + '/ws';

  // State management
  let layout = 1;
  let streams = {};
  let availableStreams = window.STREAMS_INITIAL_DATA || [];

  /**
   * Auto-select layout based on stream count
   * Always starts small and only increases if needed
   */
  function autoSelectLayout() {
    const count = Object.keys(streams).length || availableStreams.length;
    let newLayout = 1;
    if (count >= 9) newLayout = 9;
    else if (count >= 6) newLayout = 6;
    else if (count >= 4) newLayout = 4;
    else if (count >= 2) newLayout = 2;
    else newLayout = 1;

    layout = newLayout;
    document.querySelectorAll('.layout-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.layout) === layout);
    });
    updateGrid();
  }

  /**
   * Update grid layout
   */
  function updateGrid() {
    const grid = document.getElementById('streams-grid');
    grid.className = 'streams-grid layout-' + layout;
    renderCells();
  }

  /**
   * Render grid cells
   */
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
        cell.innerHTML = `
          <div class="cell-header">
            <div class="cell-title"><span class="live-dot"></span>${escapeHtml(stream.title) || escapeHtml(roomId)}</div>
            <div class="cell-controls">
              <button class="cell-btn close" data-room-id="${escapeHtml(roomId)}">×</button>
            </div>
          </div>
          <div class="cell-terminal" id="term-${escapeHtml(roomId)}"></div>
          <div class="cell-chat">
            <input type="text" id="chat-${escapeHtml(roomId)}" placeholder="💬 Chat with the agent...">
            <button class="send-chat-btn" data-room-id="${escapeHtml(roomId)}">Send</button>
          </div>
        `;
        grid.appendChild(cell);

        // Attach event listeners
        const closeBtn = cell.querySelector('.cell-btn.close');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => removeStream(roomId));
        }

        const chatInput = cell.querySelector(`#chat-${roomId}`);
        const sendBtn = cell.querySelector('.send-chat-btn');
        if (chatInput && sendBtn) {
          chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChat(roomId);
          });
          sendBtn.addEventListener('click', () => sendChat(roomId));
        }

        // Re-attach terminal to DOM
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

  /**
   * Add a stream to the grid
   */
  function addStream(roomId, title) {
    if (streams[roomId]) return;
    if (Object.keys(streams).length >= 10) {
      alert('Maximum 10 streams!');
      return;
    }

    // Create xterm instance
    const term = new Terminal({
      theme: { background: '#000000', foreground: '#c9d1d9' },
      fontSize: 11,
      fontFamily: 'SF Mono, Fira Code, monospace',
      scrollback: 1000,
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const viewerName = 'web-viewer-' + Math.random().toString(36).slice(2, 6);
      // Send auth first, then join
      ws.send(JSON.stringify({ type: 'auth', username: viewerName, role: 'viewer' }));
      ws.send(JSON.stringify({ type: 'join_stream', roomId: roomId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'terminal') {
          term.write(msg.data);
        } else if (msg.type === 'join_stream_response' && msg.success && msg.terminalBuffer) {
          term.write(msg.terminalBuffer);
        } else if (msg.type === 'chat') {
          // Show incoming chat in terminal
          const color = msg.role === 'broadcaster' ? '\x1b[33m' : '\x1b[32m';
          term.write('\r\n' + color + '[' + msg.username + ']\x1b[0m ' + msg.content);
        } else if (msg.type === 'system') {
          term.write('\r\n\x1b[90m* ' + msg.content + '\x1b[0m');
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      if (streams[roomId]) {
        streams[roomId].term.write('\r\n\x1b[31m[Stream ended]\x1b[0m');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error for room', roomId, error);
    };

    streams[roomId] = { term, ws, fitAddon, title, viewerName };
    renderCells();
    updateStreamList();
  }

  /**
   * Remove a stream from the grid
   */
  function removeStream(roomId) {
    if (streams[roomId]) {
      if (streams[roomId].ws) streams[roomId].ws.close();
      if (streams[roomId].term) streams[roomId].term.dispose();
      delete streams[roomId];
      renderCells();
      updateStreamList();
    }
  }

  /**
   * Send chat message to a stream
   */
  function sendChat(roomId) {
    const input = document.getElementById('chat-' + roomId);
    const message = input.value.trim();
    if (!message) return;

    const stream = streams[roomId];
    if (stream && stream.ws && stream.ws.readyState === WebSocket.OPEN) {
      stream.ws.send(JSON.stringify({ type: 'send_chat', content: message }));
      // Show sent message in terminal
      stream.term.write('\r\n\x1b[36m[You]\x1b[0m ' + message + '\r\n');
      input.value = '';
    }
  }

  /**
   * Update sidebar stream list
   */
  function updateStreamList() {
    const list = document.getElementById('stream-list');

    if (availableStreams.length === 0) {
      list.innerHTML = '<div class="no-streams">No streams live<br><br><small><span class="spinner"></span>Scanning for streams...<br><br>📄 <a href="/skill.md" style="color:#58a6ff">Agent API Docs</a></small></div>';
      return;
    }

    list.innerHTML = availableStreams.map(s => {
      const topicTags = (s.topics || []).slice(0, 3).map(t =>
        '<span style="background:#21262d;color:#8b949e;padding:2px 6px;border-radius:4px;font-size:9px;margin-right:4px;">' + escapeHtml(t) + '</span>'
      ).join('');

      const helpBadge = s.needsHelp ?
        '<span style="background:#f85149;color:#fff;padding:2px 6px;border-radius:4px;font-size:9px;margin-left:4px;" title="' + escapeHtml(s.helpWith || 'Needs help!') + '">🆘 Help</span>' : '';

      return `
        <div class="stream-item ${streams[s.id] ? 'added' : ''}" data-stream-id="${escapeHtml(s.id)}" data-stream-title="${escapeHtml(s.title)}">
          <div class="stream-item-title">
            <span class="live-dot" style="width:6px;height:6px;background:#f85149;border-radius:50%;flex-shrink:0;"></span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.title)}</span>
            ${helpBadge}
            <span class="viewers-badge">👥 ${s.viewers}</span>
          </div>
          <div class="stream-item-meta" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
            <span>by ${escapeHtml(s.owner)}</span>
            <span>${topicTags}</span>
          </div>
          ${s.helpWith ? '<div style="font-size:10px;color:#f0883e;margin-top:4px;font-style:italic;">💡 ' + escapeHtml(s.helpWith) + '</div>' : ''}
        </div>
      `;
    }).join('');

    // Attach event listeners to stream items
    document.querySelectorAll('.stream-item').forEach(item => {
      item.addEventListener('click', () => {
        const streamId = item.getAttribute('data-stream-id');
        const streamTitle = item.getAttribute('data-stream-title');
        if (streamId && streamTitle) {
          addStream(streamId, streamTitle);
        }
      });
    });
  }

  /**
   * Show modal
   */
  function showModal() {
    document.getElementById('add-modal').classList.add('show');
  }

  /**
   * Close modal
   */
  function closeModal() {
    document.getElementById('add-modal').classList.remove('show');
  }

  /**
   * Fetch fresh stream data from API
   */
  async function refreshStreams() {
    try {
      const res = await fetch('/api/streams');
      const data = await res.json();

      if (data.success) {
        const oldCount = availableStreams.length;
        availableStreams = data.data.streams.map(s => ({
          id: s.id,
          title: s.title,
          owner: s.ownerUsername,
          viewers: s.viewerCount,
          topics: s.topics || [],
          needsHelp: s.needsHelp || false,
          helpWith: s.helpWith || null
        }));
        updateStreamList();

        // Auto-fill grid with available streams
        const addedIds = new Set(Object.keys(streams));
        const currentCount = Object.keys(streams).length;

        // Fill empty cells with streams
        if (currentCount < layout && availableStreams.length > 0) {
          availableStreams.forEach(s => {
            if (!addedIds.has(s.id) && Object.keys(streams).length < layout) {
              addStream(s.id, s.title);
              addedIds.add(s.id);
            }
          });
        }

        // Remove streams that are no longer live
        const liveIds = new Set(availableStreams.map(s => s.id));
        Object.keys(streams).forEach(roomId => {
          if (!liveIds.has(roomId)) {
            removeStream(roomId);
          }
        });
      }
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }

  /**
   * Show archived streams when no live streams
   */
  async function showArchivedFallback() {
    if (availableStreams.length > 0 || Object.keys(streams).length > 0) return;

    const grid = document.getElementById('streams-grid');
    try {
      const res = await fetch('/api/streams/history?limit=6');
      const data = await res.json();

      if (data.success && data.data.streams.length > 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;">' +
          '<h2 style="color:#58a6ff;margin-bottom:20px;">📼 Recent Stream Archives</h2>' +
          '<p style="color:#8b949e;margin-bottom:30px;">No live streams right now. Check out recent chat replays:</p>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;max-width:1000px;margin:0 auto;">' +
          data.data.streams.map(s => {
            const duration = s.endedAt && s.startedAt ? formatDuration(s.endedAt - s.startedAt) : 'Unknown';
            return '<a href="/chat/' + s.roomId + '" style="background:#21262d;border-radius:8px;padding:16px;text-decoration:none;color:inherit;display:block;text-align:left;border:1px solid #30363d;transition:all 0.2s;"' +
              ' onmouseover="this.style.borderColor=\'#58a6ff\';this.style.transform=\'translateY(-2px)\'" ' +
              ' onmouseout="this.style.borderColor=\'#30363d\';this.style.transform=\'none\'">' +
              '<div style="font-weight:bold;color:#fff;margin-bottom:8px;">' + escapeHtml(s.title) + '</div>' +
              '<div style="font-size:12px;color:#8b949e;">Duration: ' + duration + '</div>' +
            '</a>';
          }).join('') +
          '</div>' +
          '<p style="margin-top:30px;"><a href="/history" style="color:#58a6ff;">View all archives →</a></p>' +
        '</div>';
      }
    } catch (e) {
      console.error('Archive fallback error:', e);
    }
  }

  /**
   * Format duration in milliseconds
   */
  function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    if (hr > 0) return hr + 'h ' + (min % 60) + 'm';
    if (min > 0) return min + 'm ' + (sec % 60) + 's';
    return sec + 's';
  }

  /**
   * Escape HTML
   */
  function escapeHtml(str) {
    return str ? str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;') : '';
  }

  /**
   * Handle window resize
   */
  function handleResize() {
    Object.values(streams).forEach(s => s.fitAddon.fit());
  }

  /**
   * Cleanup resources before page unload
   */
  function cleanup() {
    Object.keys(streams).forEach(roomId => {
      if (streams[roomId]) {
        if (streams[roomId].ws) streams[roomId].ws.close();
        if (streams[roomId].term) streams[roomId].term.dispose();
      }
    });
  }

  /**
   * Initialize layout button handlers
   */
  function initLayoutButtons() {
    document.querySelectorAll('.layout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        layout = parseInt(btn.dataset.layout);
        updateGrid();
      });
    });
  }

  /**
   * Initialize the app
   */
  function init() {
    // Always start with layout 1, then auto-adjust
    layout = 1;
    autoSelectLayout();

    // Initialize layout buttons
    initLayoutButtons();

    // Initial render
    updateGrid();
    updateStreamList();

    // Handle URL params for specific rooms
    const urlParams = new URLSearchParams(window.location.search);
    const roomsParam = urlParams.get('rooms');
    if (roomsParam) {
      roomsParam.split(',').forEach(roomId => {
        if (roomId.trim()) addStream(roomId.trim(), roomId.trim());
      });
    } else {
      // Auto-load from server-rendered data immediately
      availableStreams.slice(0, layout).forEach(s => {
        addStream(s.id, s.title);
      });
    }

    // Fetch fresh data immediately (will also auto-fill)
    refreshStreams();

    // Refresh every 3 seconds
    setInterval(refreshStreams, 3000);

    // Show archives after initial load if no streams
    setTimeout(showArchivedFallback, 1500);

    // Handle window resize
    window.addEventListener('resize', handleResize);

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
  }

  // Public API exposed to window
  window.streamsApp = {
    addStream,
    removeStream,
    sendChat
  };

  // Global functions for inline handlers (backward compatibility)
  window.showModal = showModal;
  window.closeModal = closeModal;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
