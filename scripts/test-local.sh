#!/bin/bash
#
# Automated local testing script for ClawdTV
# Tests: Backend → Agent → WebSocket → Frontend
#

set -e

echo "🧪 ClawdTV Local Test Suite"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
  echo ""
  echo "${YELLOW}Cleaning up...${NC}"
  pkill -f "node.*src/index.ts" 2>/dev/null || true
  pkill -f "test-agent.js" 2>/dev/null || true
  rm -f /tmp/backend.log /tmp/agent.log /tmp/test-agent.js
  echo "✅ Cleanup complete"
}

trap cleanup EXIT

# Step 1: Build
echo "${BLUE}Step 1: Building...${NC}"
npm run build:client > /dev/null 2>&1
echo "✅ Build complete"
echo ""

# Step 2: Start Backend
echo "${BLUE}Step 2: Starting backend...${NC}"
USE_REACT_FRONTEND=true DATABASE_URL="postgresql://localhost/claudetv_test" \
  node --import=tsx src/index.ts server > /tmp/backend.log 2>&1 &
sleep 4

# Check backend health
HEALTH=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ Backend running (React frontend)"
else
  echo "❌ Backend failed to start"
  cat /tmp/backend.log
  exit 1
fi
echo ""

# Step 3: Create and Start Agent
echo "${BLUE}Step 3: Starting test agent...${NC}"
cat > /tmp/test-agent.js << 'AGENT_EOF'
const http = require('http');

const post = (path, data, key) => new Promise((resolve) => {
  const body = JSON.stringify(data);
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key || '' }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => resolve(JSON.parse(d)));
  });
  req.write(body);
  req.end();
});

(async () => {
  const reg = await post('/api/agent/register', { name: 'TestAgent_' + Date.now() });
  const apiKey = reg.data.apiKey;

  const stream = await post('/api/agent/stream/start', {
    title: 'LOCAL TEST STREAM',
    cols: 120,
    rows: 30
  }, apiKey);

  console.log('WATCH_URL=' + stream.data.watchUrl.replace('https://clawdtv.com', 'http://localhost:3000'));
  console.log('ROOM_ID=' + stream.data.roomId);

  await post('/api/agent/stream/data', {
    data: '=== TEST STREAM ===\r\nAgent is live!\r\n$ '
  }, apiKey);

  // Keep alive
  setInterval(() => {}, 1000);
})();
AGENT_EOF

node /tmp/test-agent.js > /tmp/agent.log 2>&1 &
sleep 3

# Extract URLs from agent log
WATCH_URL=$(grep "WATCH_URL=" /tmp/agent.log | cut -d'=' -f2-)
ROOM_ID=$(grep "ROOM_ID=" /tmp/agent.log | cut -d'=' -f2-)

if [ -z "$WATCH_URL" ]; then
  echo "❌ Agent failed to start"
  cat /tmp/agent.log
  exit 1
fi

echo "✅ Agent streaming"
echo "   Room ID: $ROOM_ID"
echo ""

# Step 4: Test Stream Exists
echo "${BLUE}Step 4: Verifying stream exists...${NC}"
STREAM=$(curl -s "http://localhost:3000/api/streams/$ROOM_ID")
if echo "$STREAM" | grep -q '"isLive":true'; then
  echo "✅ Stream is live and visible in API"
else
  echo "❌ Stream not found or not live"
  echo "$STREAM"
  exit 1
fi
echo ""

# Step 5: Instructions
echo "${GREEN}======================================"
echo "✅ LOCAL TEST ENVIRONMENT READY!"
echo "======================================${NC}"
echo ""
echo "📺 Watch URL:"
echo "   ${YELLOW}$WATCH_URL${NC}"
echo ""
echo "🔍 Open in browser and check DevTools console for:"
echo "   ✅ [WebSocket] Connected"
echo "   ✅ [WebSocket] Authenticated"
echo "   ✅ [useStream] Successfully joined"
echo "   ✅ Terminal showing 'TEST STREAM'"
echo ""
echo "❌ If you see React error #185:"
echo "   - Check console for which log appears last"
echo "   - Share the full console output"
echo ""
echo "📋 Logs:"
echo "   Backend: /tmp/backend.log"
echo "   Agent: /tmp/agent.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Keep script running
wait
