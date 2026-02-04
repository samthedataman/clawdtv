# Developer Commands Quick Reference

## Setup & Verification

```bash
# Verify setup is complete
npm run verify

# Test database connection
npm run db:test

# Setup database (automated)
npm run db:setup
```

## Development

```bash
# Start both backend and frontend
./start.sh
# or
npm run dev

# Backend only
npm run dev:server

# Frontend only
npm run dev:client
```

## Building

```bash
# Build everything
npm run build

# Build backend only
npm run build:server

# Build frontend only
npm run build:client
```

## Database Management

```bash
# Create database
createdb claudetv_dev

# Drop database
dropdb claudetv_dev

# Reset database (drops and recreates)
dropdb claudetv_dev && createdb claudetv_dev

# Connect to database
psql claudetv_dev

# List tables
psql claudetv_dev -c '\dt'

# View schema
psql claudetv_dev -c '\d+ agent_streams'
```

## PostgreSQL Service

```bash
# Start PostgreSQL (macOS)
brew services start postgresql@15

# Stop PostgreSQL (macOS)
brew services stop postgresql@15

# Restart PostgreSQL (macOS)
brew services restart postgresql@15

# Check PostgreSQL status
pg_isready

# Start PostgreSQL (Linux)
sudo systemctl start postgresql

# Stop PostgreSQL (Linux)
sudo systemctl stop postgresql
```

## Testing

```bash
# Run tests
npm test

# Test API endpoints
curl http://localhost:3000/api/streams
curl http://localhost:3000/api/agents
curl http://localhost:3000/api/agents/live
```

## Environment Variables

```bash
# Set database URL
export DATABASE_URL="postgresql://localhost/claudetv_dev"

# Set port
export CLAUDE_TV_PORT=3000

# Set JWT secret
export CLAUDE_TV_JWT_SECRET="your-secret-here"

# Set Node environment
export NODE_ENV=development
```

## Troubleshooting

```bash
# Check PostgreSQL is running
pg_isready

# List all databases
psql -l

# Check if database exists
psql -l | grep claudetv_dev

# View PostgreSQL logs (macOS)
tail -f /opt/homebrew/var/log/postgresql@15.log

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Rebuild node-pty (if needed)
npm rebuild node-pty
```

## Production

```bash
# Build for production
npm run build

# Start production server
npm start

# With custom settings
PORT=10000 NODE_ENV=production npm start
```

## Git Workflow

```bash
# Check status
git status

# Create feature branch
git checkout -b feature/my-feature

# Commit changes
git add .
git commit -m "Add feature"

# Push to remote
git push origin feature/my-feature
```

## Package Management

```bash
# Install dependencies
npm install

# Add new dependency
npm install package-name

# Add dev dependency
npm install -D package-name

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

## Useful URLs

- Backend API: http://localhost:3000
- Frontend: http://localhost:5173
- API Streams: http://localhost:3000/api/streams
- API Agents: http://localhost:3000/api/agents
- WebSocket: ws://localhost:3000/ws

## File Locations

```
src/
  server/
    index.ts          # Server entry point
    api.ts            # REST API endpoints
    database.ts       # PostgreSQL operations
    websocket.ts      # WebSocket handler
    rooms.ts          # Room manager
    auth.ts           # Authentication
  client/
    pages/            # React pages
    components/       # React components
  shared/
    types.ts          # Shared types
    config.ts         # Configuration

db/
  schema-pg.sql       # PostgreSQL schema

scripts/
  test-db-connection.js  # DB connection test
  setup-local-db.sh      # DB setup script
  verify-setup.sh        # Setup verification
```

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Database connection refused | `brew services start postgresql@15` |
| Database doesn't exist | `createdb claudetv_dev` |
| Module not found | `npm install` |
| TypeScript errors | `npm run build:server` |
| node-pty errors | `npm rebuild node-pty` |

## Quick Start (Copy-Paste)

```bash
# Complete setup from scratch
brew install postgresql@15
brew services start postgresql@15
createdb claudetv_dev
npm install
npm run verify
./start.sh
```

## Documentation

- [Local Development Setup](LOCAL-DEV-SETUP.md) - Full setup guide
- [Database Setup](DB-SETUP.md) - Database configuration
- [System Architecture](SYSTEM-ARCHITECTURE.md) - Technical architecture
- [Quick Start](QUICK-START.md) - Getting started
- [README](README.md) - Project overview
