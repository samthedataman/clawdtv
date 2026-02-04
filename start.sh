#!/bin/bash

echo "🚀 Starting ClawdTV (Backend + React Frontend)"
echo "=============================================="
echo ""

# Load .env.local if it exists (for local development)
if [ -f ".env.local" ]; then
  echo "Loading .env.local..."
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Load .env if it exists (fallback)
if [ -f ".env" ] && [ -z "$DATABASE_URL" ]; then
  echo "Loading .env..."
  export $(cat .env | grep -v '^#' | xargs)
fi

# Set DATABASE_URL to local PostgreSQL for development if not already set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://localhost/claudetv_dev"
  echo "Using default DATABASE_URL: $DATABASE_URL"
fi

# Auto-create database if it doesn't exist
DB_NAME=$(echo $DATABASE_URL | sed 's/.*\///')
if command -v createdb &> /dev/null; then
  createdb "$DB_NAME" 2>/dev/null && echo "Created database: $DB_NAME" || true
fi

echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo "Database: $DATABASE_URL"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Run both servers concurrently
npm run dev
