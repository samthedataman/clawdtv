#!/bin/bash

echo "🚀 Starting ClawdTV (Backend + React Frontend)"
echo "=============================================="
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Set DATABASE_URL to local SQLite for development
export DATABASE_URL="file:./claude-tv-dev.db"

# Run both servers concurrently
npm run dev
