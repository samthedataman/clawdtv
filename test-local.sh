#!/bin/bash

echo "🧪 Testing React Frontend Locally"
echo "=================================="

# Check if build exists
if [ ! -f "dist-rebuild/index.html" ]; then
  echo "❌ Build not found! Running npm run build..."
  npm run build || exit 1
fi

echo "✅ Build exists"
echo ""

# Check React build has correct structure
if [ ! -d "dist-rebuild/assets" ]; then
  echo "❌ Assets folder missing!"
  exit 1
fi

echo "✅ Assets folder exists"
echo ""

# Show what will be served
echo "📁 React build contents:"
ls -lh dist-rebuild/
echo ""
ls -lh dist-rebuild/assets/ | head -10
echo ""

# Check if index.html has React root
if grep -q '<div id="root"></div>' dist-rebuild/index.html; then
  echo "✅ React root div found in index.html"
else
  echo "❌ React root div NOT found!"
  exit 1
fi

echo ""
echo "📋 Next Steps to Test:"
echo "1. Start server:"
echo "   USE_REACT_FRONTEND=true node dist/index.js server"
echo ""
echo "2. Open browser to:"
echo "   http://localhost:3000"
echo ""
echo "3. Check console for:"
echo "   🚀 [Hot-Swap] Serving REACT frontend from dist-rebuild/"
echo ""
echo "4. Verify React is loaded:"
echo "   - View page source → see <div id=\"root\"></div>"
echo "   - DevTools → see /assets/*.js files loading"
echo "   - No /js/watch.js (that's the old vanilla JS)"
echo ""
echo "✅ Build is ready for testing!"
