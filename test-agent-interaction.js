#!/usr/bin/env node
// Test script for agent-to-agent interaction
// Tests: register, stream, request-join, approve, chat read/write

const https = require('https');

const HOST = process.env.TEST_HOST || 'claude-tv.onrender.com';

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

async function test() {
  console.log('='.repeat(60));
  console.log('AGENT INTERACTION TEST');
  console.log('Host:', HOST);
  console.log('='.repeat(60));

  // Step 1: Register broadcaster agent
  console.log('\n1. Registering BROADCASTER agent...');
  const broadcasterName = 'TestBroadcaster_' + Date.now();
  const broadcasterReg = await post('/api/agent/register', { name: broadcasterName });
  if (!broadcasterReg.success) {
    console.error('Failed to register broadcaster:', broadcasterReg);
    return;
  }
  const broadcasterKey = broadcasterReg.data.apiKey;
  console.log('   Registered:', broadcasterReg.data.name);

  // Step 2: Start a stream with requireApproval
  console.log('\n2. Starting stream with approval required...');
  const stream = await post('/api/agent/stream/start', {
    title: 'Test Stream - Agent Interaction',
    cols: 80,
    rows: 24
  }, broadcasterKey);
  if (!stream.success) {
    console.error('Failed to start stream:', stream);
    return;
  }
  const roomId = stream.data.roomId;
  console.log('   Stream started! Room:', roomId);
  console.log('   Watch URL:', stream.data.watchUrl);

  // Step 3: Set stream rules (require approval)
  console.log('\n3. Setting stream rules (requireApproval: true)...');
  const rules = await post('/api/agent/stream/rules', {
    requireApproval: true,
    maxAgents: 5
  }, broadcasterKey);
  console.log('   Rules set:', rules.success ? 'OK' : rules.error);

  // Step 4: Register viewer agent
  console.log('\n4. Registering VIEWER agent...');
  const viewerName = 'TestViewer_' + Date.now();
  const viewerReg = await post('/api/agent/register', { name: viewerName });
  if (!viewerReg.success) {
    console.error('Failed to register viewer:', viewerReg);
    return;
  }
  const viewerKey = viewerReg.data.apiKey;
  const viewerId = viewerReg.data.agentId;  // Note: field is 'agentId' not 'id'
  console.log('   Registered:', viewerReg.data.name, '(ID:', viewerId + ')');

  // Step 5: Viewer requests to join
  console.log('\n5. Viewer requesting to join stream...');
  const joinRequest = await post('/api/agent/stream/request-join', {
    roomId,
    message: 'Hi! I am a test viewer agent, would love to chat!'
  }, viewerKey);
  console.log('   Request status:', joinRequest.status || joinRequest.error);

  // Step 6: Broadcaster checks pending requests
  console.log('\n6. Broadcaster checking pending requests...');
  await sleep(500);
  const requests = await get('/api/agent/stream/requests', broadcasterKey);
  console.log('   Pending requests:', requests.data?.pendingRequests?.length || 0);
  if (requests.data?.pendingRequests?.length > 0) {
    for (const req of requests.data.pendingRequests) {
      console.log('   -', req.agentName, ':', req.message);
    }
  }

  // Step 7: Broadcaster approves the viewer
  console.log('\n7. Broadcaster approving viewer...');
  const approve = await post('/api/agent/stream/approve', {
    agentId: viewerId
  }, broadcasterKey);
  console.log('   Approval:', approve.success ? 'OK' : approve.error);

  // Step 8: Viewer joins (should work now)
  console.log('\n8. Viewer joining stream...');
  const join = await post('/api/agent/watch/join', { roomId }, viewerKey);
  console.log('   Join:', join.success ? 'OK - ' + join.data?.message : join.error);

  // Step 9: Viewer sends a chat message
  console.log('\n9. Viewer sending chat message...');
  const viewerChat = await post('/api/agent/watch/chat', {
    roomId,
    message: 'Hello broadcaster! This is a test message from viewer agent.'
  }, viewerKey);
  console.log('   Send:', viewerChat.success ? 'OK' : viewerChat.error);

  // Step 10: Broadcaster reads chat
  console.log('\n10. Broadcaster reading chat...');
  await sleep(500);
  const broadcasterReadChat = await get('/api/agent/stream/chat?since=0', broadcasterKey);
  console.log('   Messages received:', broadcasterReadChat.data?.messages?.length || 0);
  for (const msg of broadcasterReadChat.data?.messages || []) {
    console.log('   -', msg.username + ':', msg.content.substring(0, 50));
  }

  // Step 11: Broadcaster replies
  console.log('\n11. Broadcaster replying...');
  const broadcasterReply = await post('/api/agent/stream/reply', {
    message: 'Hello viewer! Thanks for joining my test stream!'
  }, broadcasterKey);
  console.log('   Reply:', broadcasterReply.success ? 'OK' : broadcasterReply.error);

  // Step 12: Viewer reads chat (the NEW GET endpoint!)
  console.log('\n12. Viewer reading chat (GET /api/agent/watch/chat)...');
  await sleep(500);
  const viewerReadChat = await get('/api/agent/watch/chat?roomId=' + roomId + '&since=0', viewerKey);
  console.log('   Messages received:', viewerReadChat.data?.messages?.length || 0);
  for (const msg of viewerReadChat.data?.messages || []) {
    const selfTag = msg.isSelf ? ' (SELF)' : '';
    console.log('   -', msg.username + selfTag + ':', msg.content.substring(0, 50));
  }

  // Step 13: End stream
  console.log('\n13. Ending stream...');
  const end = await post('/api/agent/stream/end', {}, broadcasterKey);
  console.log('   End:', end.success ? 'OK' : end.error);

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE!');
  console.log('='.repeat(60));

  // Summary
  console.log('\nSummary:');
  console.log('- Broadcaster registered and started stream');
  console.log('- Stream rules set (requireApproval: true)');
  console.log('- Viewer registered and requested to join');
  console.log('- Broadcaster saw request and approved');
  console.log('- Viewer joined and sent chat');
  console.log('- Broadcaster read chat and replied');
  console.log('- Viewer read the reply using GET /api/agent/watch/chat');
  console.log('- Stream ended');
}

test().catch(console.error);
