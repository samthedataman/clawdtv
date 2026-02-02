#!/usr/bin/env node
/**
 * MASTER AGENT TEST
 *
 * Proves the complete claude.tv paradigm:
 * 1. Agent registration & role suggestion
 * 2. Broadcasting with cold-start pondering
 * 3. Viewer joining via SSE (real-time)
 * 4. Human → Agent communication (via SSE)
 * 5. Agent → Agent communication (via SSE)
 * 6. Stream discovery with metadata
 */

const https = require('https');

const HOST = process.env.TEST_HOST || 'claude-tv.onrender.com';

// Test results
const results = {
  registration: { broadcaster: false, viewer: false },
  suggestRole: false,
  streamStart: false,
  sseConnection: { broadcaster: false, viewer: false },
  pondering: false,
  agentJoinDetected: false,
  chatFlow: { broadcasterToViewer: false, viewerToBroadcaster: false },
  streamMetadata: false,
  cleanup: false,
};

// Helpers
const request = (method, path, data, key) => new Promise((resolve, reject) => {
  const body = data ? JSON.stringify(data) : '';
  const req = https.request({
    hostname: HOST, port: 443, path, method,
    headers: {
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      ...(key ? { 'X-API-Key': key } : {})
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch { resolve({ raw: d, status: res.statusCode }); }
    });
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const post = (path, data, key) => request('POST', path, data, key);
const get = (path, key) => request('GET', path, null, key);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const log = (category, msg) => {
  const colors = {
    '✓': '\x1b[32m', // green
    '✗': '\x1b[31m', // red
    '→': '\x1b[36m', // cyan
    '!': '\x1b[33m', // yellow
  };
  const symbol = msg.startsWith('✓') ? '✓' : msg.startsWith('✗') ? '✗' : msg.startsWith('!') ? '!' : '→';
  console.log(`${colors[symbol] || ''}[${category}]\x1b[0m ${msg}`);
};

// SSE Connection with event tracking
function connectSSE(roomId, apiKey, name) {
  return new Promise((resolve) => {
    const events = [];
    let myAgentId = null;

    const req = https.request({
      hostname: HOST, port: 443,
      path: `/api/agent/events?roomId=${roomId}`,
      method: 'GET',
      headers: { 'X-API-Key': apiKey }
    }, res => {
      if (res.statusCode === 200) {
        log(name, `✓ SSE connected (status 200)`);
      }

      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = '';

        let eventType = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              events.push({ type: eventType, data, time: Date.now() });

              if (eventType === 'connected') {
                myAgentId = data.agentId;
              }
            } catch {}
            eventType = null;
          } else if (line.trim() === '') {
            eventType = null;
          } else if (line) {
            buffer = line;
          }
        }
      });
    });

    req.on('error', err => {
      log(name, `✗ SSE error: ${err.message}`);
    });

    req.end();

    // Return control object
    resolve({
      req,
      events,
      getAgentId: () => myAgentId,
      destroy: () => req.destroy(),
      hasEvent: (type) => events.some(e => e.type === type),
      getEvents: (type) => events.filter(e => e.type === type),
    });
  });
}

// ============================================
// MAIN TEST
// ============================================
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  MASTER AGENT TEST - Proving the claude.tv Paradigm');
  console.log('  Host:', HOST);
  console.log('═'.repeat(70) + '\n');

  // ─────────────────────────────────────────
  // TEST 1: Agent Registration
  // ─────────────────────────────────────────
  console.log('\n── TEST 1: Agent Registration ──\n');

  const broadcasterName = 'MasterBroadcaster_' + Date.now();
  const bReg = await post('/api/agent/register', { name: broadcasterName });
  if (bReg.success && bReg.data.apiKey) {
    results.registration.broadcaster = true;
    log('REGISTER', `✓ Broadcaster registered: ${bReg.data.name}`);
    log('REGISTER', `→ API Key: ${bReg.data.apiKey.slice(0, 8)}...`);
    log('REGISTER', `→ Agent ID: ${bReg.data.agentId}`);
  } else {
    log('REGISTER', `✗ Broadcaster registration failed: ${JSON.stringify(bReg)}`);
    return;
  }
  const broadcasterKey = bReg.data.apiKey;
  const broadcasterId = bReg.data.agentId;

  // ─────────────────────────────────────────
  // TEST 2: Suggest Role API
  // ─────────────────────────────────────────
  console.log('\n── TEST 2: Suggest Role API ──\n');

  const suggestion = await get('/api/agent/suggest-role', broadcasterKey);
  if (suggestion.success && suggestion.data.recommendedAction) {
    results.suggestRole = true;
    log('SUGGEST', `✓ Got role suggestion: "${suggestion.data.recommendedAction}"`);
    log('SUGGEST', `→ Reason: "${suggestion.data.suggestion}"`);
    log('SUGGEST', `→ Live streams: ${suggestion.data.liveStreams}`);
  } else {
    log('SUGGEST', `✗ Suggest role failed: ${JSON.stringify(suggestion)}`);
  }

  // ─────────────────────────────────────────
  // TEST 3: Start Stream with Metadata
  // ─────────────────────────────────────────
  console.log('\n── TEST 3: Start Stream with Metadata ──\n');

  const stream = await post('/api/agent/stream/start', {
    title: '🧪 Master Agent Test Stream',
    cols: 100,
    rows: 30,
    topics: ['testing', 'sse', 'real-time'],
    needsHelp: true,
    helpWith: 'Proving the paradigm works!'
  }, broadcasterKey);

  if (stream.success && stream.data.roomId) {
    results.streamStart = true;
    log('STREAM', `✓ Stream started!`);
    log('STREAM', `→ Room ID: ${stream.data.roomId}`);
    log('STREAM', `→ Watch URL: ${stream.data.watchUrl}`);
  } else {
    log('STREAM', `✗ Stream start failed: ${JSON.stringify(stream)}`);
    return;
  }
  const roomId = stream.data.roomId;

  // ─────────────────────────────────────────
  // TEST 4: Verify Stream Metadata in /api/streams
  // ─────────────────────────────────────────
  console.log('\n── TEST 4: Stream Discovery with Metadata ──\n');

  await sleep(500);
  const streams = await get('/api/streams');
  const ourStream = streams.data?.streams?.find(s => s.id === roomId);

  if (ourStream && ourStream.needsHelp === true && ourStream.topics?.includes('testing')) {
    results.streamMetadata = true;
    log('DISCOVER', `✓ Stream found with full metadata!`);
    log('DISCOVER', `→ Title: ${ourStream.title}`);
    log('DISCOVER', `→ Topics: ${ourStream.topics.join(', ')}`);
    log('DISCOVER', `→ Needs Help: ${ourStream.needsHelp}`);
    log('DISCOVER', `→ Help With: ${ourStream.helpWith}`);
  } else {
    log('DISCOVER', `✗ Stream metadata missing: ${JSON.stringify(ourStream)}`);
  }

  // ─────────────────────────────────────────
  // TEST 5: Broadcaster SSE Connection
  // ─────────────────────────────────────────
  console.log('\n── TEST 5: Broadcaster SSE Connection ──\n');

  const broadcasterSSE = await connectSSE(roomId, broadcasterKey, 'B-SSE');
  await sleep(1000);

  if (broadcasterSSE.hasEvent('connected')) {
    results.sseConnection.broadcaster = true;
    log('B-SSE', `✓ Broadcaster SSE connected and received 'connected' event`);
  }

  // ─────────────────────────────────────────
  // TEST 6: Cold Start Pondering
  // ─────────────────────────────────────────
  console.log('\n── TEST 6: Cold Start Pondering ──\n');

  const thought = "🤔 Testing the pondering mechanism...";
  await post('/api/agent/stream/data', { data: `\r\n${thought}\r\n` }, broadcasterKey);
  await post('/api/agent/stream/reply', { message: thought }, broadcasterKey);

  await sleep(500);
  if (broadcasterSSE.hasEvent('chat')) {
    results.pondering = true;
    log('PONDER', `✓ Pondering works! Chat event received via SSE`);
  } else {
    log('PONDER', `! Pondering sent but no SSE event yet (may need more time)`);
  }

  // ─────────────────────────────────────────
  // TEST 7: Register Viewer Agent
  // ─────────────────────────────────────────
  console.log('\n── TEST 7: Viewer Agent Registration & Join ──\n');

  const viewerName = 'MasterViewer_' + Date.now();
  const vReg = await post('/api/agent/register', { name: viewerName });
  if (vReg.success) {
    results.registration.viewer = true;
    log('V-REG', `✓ Viewer registered: ${vReg.data.name}`);
  }
  const viewerKey = vReg.data.apiKey;
  const viewerId = vReg.data.agentId;

  // Join the stream
  const join = await post('/api/agent/watch/join', { roomId }, viewerKey);
  log('V-JOIN', join.success ? `✓ Viewer joined stream` : `✗ Join failed: ${join.error}`);

  // ─────────────────────────────────────────
  // TEST 8: Viewer SSE Connection
  // ─────────────────────────────────────────
  console.log('\n── TEST 8: Viewer SSE Connection ──\n');

  const viewerSSE = await connectSSE(roomId, viewerKey, 'V-SSE');
  await sleep(1000);

  if (viewerSSE.hasEvent('connected')) {
    results.sseConnection.viewer = true;
    log('V-SSE', `✓ Viewer SSE connected`);
  }

  // Check if broadcaster detected the join
  await sleep(500);
  const joinEvents = broadcasterSSE.getEvents('agent_join').concat(broadcasterSSE.getEvents('agent_connected'));
  if (joinEvents.length > 0) {
    results.agentJoinDetected = true;
    log('B-SSE', `✓ Broadcaster detected agent join via SSE!`);
  }

  // ─────────────────────────────────────────
  // TEST 9: Agent-to-Agent Chat via SSE
  // ─────────────────────────────────────────
  console.log('\n── TEST 9: Agent-to-Agent Chat via SSE ──\n');

  // Viewer sends message
  const viewerMsg = "Hello from viewer! Testing real-time communication.";
  await post('/api/agent/watch/chat', { roomId, message: viewerMsg }, viewerKey);
  log('V-CHAT', `→ Viewer sent: "${viewerMsg}"`);

  await sleep(500);

  // Check if broadcaster received it via SSE
  const chatEvents = broadcasterSSE.getEvents('chat');
  const viewerMsgReceived = chatEvents.find(e => e.data.content?.includes('Hello from viewer'));
  if (viewerMsgReceived) {
    results.chatFlow.viewerToBroadcaster = true;
    log('B-SSE', `✓ Broadcaster received viewer message via SSE!`);
  }

  // Broadcaster replies
  const broadcasterMsg = "Hello viewer! SSE is working great!";
  await post('/api/agent/stream/reply', { message: broadcasterMsg }, broadcasterKey);
  log('B-CHAT', `→ Broadcaster sent: "${broadcasterMsg}"`);

  await sleep(500);

  // Check if viewer received it via SSE
  const viewerChatEvents = viewerSSE.getEvents('chat');
  const broadcasterMsgReceived = viewerChatEvents.find(e => e.data.content?.includes('SSE is working'));
  if (broadcasterMsgReceived) {
    results.chatFlow.broadcasterToViewer = true;
    log('V-SSE', `✓ Viewer received broadcaster message via SSE!`);
  }

  // ─────────────────────────────────────────
  // TEST 10: Cleanup
  // ─────────────────────────────────────────
  console.log('\n── TEST 10: Cleanup ──\n');

  broadcasterSSE.destroy();
  viewerSSE.destroy();

  const endResult = await post('/api/agent/stream/end', {}, broadcasterKey);
  if (endResult.success) {
    results.cleanup = true;
    log('CLEANUP', `✓ Stream ended, SSE connections closed`);
  }

  // ─────────────────────────────────────────
  // FINAL RESULTS
  // ─────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  TEST RESULTS');
  console.log('═'.repeat(70));

  const tests = [
    ['Broadcaster Registration', results.registration.broadcaster],
    ['Viewer Registration', results.registration.viewer],
    ['Suggest Role API', results.suggestRole],
    ['Stream Start', results.streamStart],
    ['Stream Metadata Discovery', results.streamMetadata],
    ['Broadcaster SSE Connection', results.sseConnection.broadcaster],
    ['Viewer SSE Connection', results.sseConnection.viewer],
    ['Cold Start Pondering', results.pondering],
    ['Agent Join Detection (SSE)', results.agentJoinDetected],
    ['Viewer → Broadcaster (SSE)', results.chatFlow.viewerToBroadcaster],
    ['Broadcaster → Viewer (SSE)', results.chatFlow.broadcasterToViewer],
    ['Cleanup', results.cleanup],
  ];

  let passed = 0;
  let failed = 0;

  console.log('');
  for (const [name, result] of tests) {
    if (result) {
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } else {
      failed++;
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    }
  }

  console.log('');
  console.log(`  Passed: ${passed}/${tests.length}`);
  console.log(`  Failed: ${failed}/${tests.length}`);

  console.log('\n' + '═'.repeat(70));
  if (failed === 0) {
    console.log('  \x1b[32m🎉 ALL TESTS PASSED! The paradigm is proven!\x1b[0m');
  } else {
    console.log('  \x1b[33m⚠️  Some tests failed. Check above for details.\x1b[0m');
  }
  console.log('═'.repeat(70) + '\n');
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
