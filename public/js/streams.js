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
  let layout = 2;
  let streams = {};
  let availableStreams = window.STREAMS_INITIAL_DATA || [];

  /**
   * Update grid layout
   */
  function updateGrid() {
    const grid = document.getElementById('streams-grid');
    grid.className = 'streams-grid layout-' + layout;
    renderCells();
    // Refit all terminals after layout change
    requestAnimationFrame(() => {
      handleResize();
    });
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
          <div class="cell-chat-container">
            <div class="cell-chat-messages" id="chat-messages-${escapeHtml(roomId)}"></div>
            <div class="cell-chat-input">
              <input type="text" id="chat-${escapeHtml(roomId)}" placeholder="💬 Chat with the agent...">
              <button class="send-chat-btn" data-room-id="${escapeHtml(roomId)}">Send</button>
            </div>
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

    // Generate viewer name before WebSocket connection
    const viewerName = 'web-viewer-' + Math.random().toString(36).slice(2, 6);

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send auth first, then join
      ws.send(JSON.stringify({ type: 'auth', username: viewerName, role: 'viewer' }));
      ws.send(JSON.stringify({ type: 'join_stream', roomId: roomId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'join_stream_response') {
          if (msg.success) {
            addChatMessage(roomId, 'system', null, '✓ Connected to stream');
            // Load recent messages if provided
            if (msg.recentMessages && msg.recentMessages.length > 0) {
              msg.recentMessages.forEach(m => {
                addChatMessage(roomId, m.role || 'viewer', m.username, m.content, m.timestamp);
              });
            }
          } else {
            addChatMessage(roomId, 'system', null, '✗ Failed to join: ' + (msg.error || 'Unknown error'));
          }
        } else if (msg.type === 'auth_response') {
          if (!msg.success) {
            addChatMessage(roomId, 'system', null, '✗ Auth failed: ' + (msg.error || 'Unknown error'));
          }
        } else if (msg.type === 'error') {
          addChatMessage(roomId, 'system', null, '✗ ' + (msg.message || msg.error || 'Unknown error'));
        } else if (msg.type === 'chat') {
          addChatMessage(roomId, msg.role || 'viewer', msg.username, msg.content);
        } else if (msg.type === 'system') {
          addChatMessage(roomId, 'system', null, msg.content);
        } else if (msg.type === 'viewer_join') {
          addChatMessage(roomId, 'system', null, msg.username + ' joined');
        } else if (msg.type === 'viewer_leave') {
          addChatMessage(roomId, 'system', null, msg.username + ' left');
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      if (streams[roomId]) {
        addChatMessage(roomId, 'system', null, '🔴 Stream ended');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error for room', roomId, error);
    };

    streams[roomId] = { ws, title, viewerName };
    renderCells();
    updateStreamList();
  }

  /**
   * Remove a stream from the grid
   */
  function removeStream(roomId) {
    if (streams[roomId]) {
      if (streams[roomId].ws) streams[roomId].ws.close();
      delete streams[roomId];
      renderCells();
      updateStreamList();
    }
  }

  // Color palette for usernames (vibrant, easy to distinguish)
  const USERNAME_COLORS = [
    '#58a6ff', // blue
    '#f0883e', // orange
    '#a371f7', // purple
    '#3fb950', // green
    '#f85149', // red
    '#db61a2', // pink
    '#79c0ff', // light blue
    '#d29922', // gold
    '#56d364', // lime
    '#ff7b72', // coral
    '#bc8cff', // lavender
    '#7ee787', // mint
    '#ffa657', // peach
    '#ff9bce', // rose
    '#39d353', // emerald
  ];

  // Get consistent color for a username
  function getUsernameColor(username) {
    if (!username) return USERNAME_COLORS[0];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = ((hash << 5) - hash) + username.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return USERNAME_COLORS[Math.abs(hash) % USERNAME_COLORS.length];
  }

  /**
   * Add a chat message to the chat container
   */
  function addChatMessage(roomId, role, username, content, timestamp) {
    const container = document.getElementById('chat-messages-' + roomId);
    if (!container) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg ' + (role || 'viewer');

    const time = timestamp ? new Date(timestamp) : new Date();
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (role === 'system') {
      msgEl.innerHTML = '<span class="content">' + escapeHtml(content) + '</span>';
    } else {
      const color = getUsernameColor(username);
      msgEl.innerHTML =
        '<span class="username" style="color:' + color + '">' + escapeHtml(username || 'Anonymous') + '</span>' +
        '<span class="content">' + escapeHtml(content) + '</span>' +
        '<span class="time">' + timeStr + '</span>';
    }

    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
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
      // Show sent message in chat container
      addChatMessage(roomId, 'viewer', stream.viewerName || 'You', message);
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
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;max-width:1200px;margin:0 auto;padding:0 20px;">' +
          data.data.streams.map(s => {
            const duration = s.endedAt && s.startedAt ? formatDuration(s.endedAt - s.startedAt) : 'Unknown';
            // Truncate title to 50 chars max
            const title = s.title && s.title.length > 50 ? s.title.substring(0, 50) + '...' : (s.title || 'Untitled Stream');
            const agentName = s.agentName || 'Unknown Agent';
            return '<a href="/chat/' + s.roomId + '" class="archive-card" style="' +
              'background:#0d1117;border-radius:8px;text-decoration:none;color:inherit;display:block;' +
              'border:1px solid #30363d;transition:all 0.2s;overflow:hidden;"' +
              ' onmouseover="this.style.borderColor=\'#58a6ff\';this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 12px rgba(88,166,255,0.15)\'" ' +
              ' onmouseout="this.style.borderColor=\'#30363d\';this.style.transform=\'none\';this.style.boxShadow=\'none\'">' +
              // Terminal header bar
              '<div style="background:#161b22;padding:8px 12px;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px;">' +
                '<div style="display:flex;gap:6px;">' +
                  '<span style="width:12px;height:12px;border-radius:50%;background:#f85149;"></span>' +
                  '<span style="width:12px;height:12px;border-radius:50%;background:#f0883e;"></span>' +
                  '<span style="width:12px;height:12px;border-radius:50%;background:#3fb950;"></span>' +
                '</div>' +
                '<span style="font-size:11px;color:#8b949e;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(agentName) + '</span>' +
              '</div>' +
              // Terminal body
              '<div style="padding:16px;font-family:\'SF Mono\',\'Fira Code\',monospace;min-height:100px;background:#0d1117;">' +
                '<div style="color:#3fb950;font-size:12px;margin-bottom:8px;">$ cat stream.log</div>' +
                '<div style="color:#c9d1d9;font-size:13px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(title) + '</div>' +
                '<div style="color:#8b949e;font-size:11px;margin-top:12px;">Duration: ' + duration + '</div>' +
              '</div>' +
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
    // No-op: terminal removed, chat handles its own sizing
  }

  /**
   * Cleanup resources before page unload
   */
  function cleanup() {
    Object.keys(streams).forEach(roomId => {
      if (streams[roomId] && streams[roomId].ws) {
        streams[roomId].ws.close();
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
    // Start with layout 2 (side-by-side)
    layout = 2;
    document.querySelectorAll('.layout-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.layout) === 2);
    });

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
