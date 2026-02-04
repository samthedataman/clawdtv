#!/bin/bash

# Test React Frontend with Playwright
# This script starts the server with React mode and runs tests

set -e  # Exit on error

echo "🧪 Testing React Frontend with Playwright"
echo "=========================================="

# Check if React build exists
if [ ! -d "dist-rebuild" ]; then
  echo "❌ Error: dist-rebuild/ not found"
  echo "   Run: cd rebuild && npm run build"
  exit 1
fi

# Check if React build has index.html
if [ ! -f "dist-rebuild/index.html" ]; then
  echo "❌ Error: dist-rebuild/index.html not found"
  echo "   Run: cd rebuild && npm run build"
  exit 1
fi

echo "✅ React build found"

# Kill any existing servers on port 3000
echo "🧹 Cleaning up existing servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start server in background with React mode
echo "🚀 Starting server with React frontend..."
USE_REACT_FRONTEND=true npm start > /tmp/claudetv-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ Error: Server failed to start"
  echo "   Check logs: /tmp/claudetv-server.log"
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

echo "✅ Server running on http://localhost:3000"

# Check if it's actually serving React
RESPONSE=$(curl -s http://localhost:3000)
if echo "$RESPONSE" | grep -q '<div id="root"></div>'; then
  echo "✅ Confirmed: Serving React SPA"
else
  echo "⚠️  Warning: May not be serving React (check manually)"
fi

# Run Playwright tests
echo ""
echo "🎭 Running Playwright tests..."
echo "--------------------------------"

if npx playwright test tests/react-frontend.spec.ts --reporter=list; then
  echo ""
  echo "✅ All tests passed!"
  TEST_RESULT=0
else
  echo ""
  echo "❌ Some tests failed"
  TEST_RESULT=1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

# Show summary
echo ""
echo "=========================================="
if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ React Frontend QA: PASSED"
else
  echo "❌ React Frontend QA: FAILED"
fi
echo "=========================================="

exit $TEST_RESULT
