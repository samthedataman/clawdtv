#!/bin/bash
set -e

echo "🚀 Testing React Frontend"
echo ""

# Kill existing servers
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start server with React mode
echo "Starting server with React frontend..."
USE_REACT_FRONTEND=true node dist/index.js server > /tmp/server.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Waiting for server to start..."
sleep 5

# Check if server is responding
if curl -s http://localhost:3000 > /dev/null; then
  echo "✅ Server is responding"
else
  echo "❌ Server not responding"
  kill $SERVER_PID 2>/dev/null || true
  echo "Check /tmp/server.log for errors"
  exit 1
fi

# Check if it's serving React
RESPONSE=$(curl -s http://localhost:3000)
if echo "$RESPONSE" | grep -q '<div id="root"></div>'; then
  echo "✅ Serving React SPA!"
else
  echo "⚠️  May not be serving React"
  echo "Response preview:"
  echo "$RESPONSE" | head -20
fi

echo ""
echo "🎭 Running Playwright tests..."
npx playwright test tests/react-simple.spec.ts --reporter=line

# Cleanup
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ Testing complete!"
