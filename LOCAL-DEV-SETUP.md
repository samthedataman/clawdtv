# Local Development Setup Guide

This guide will help you set up ClawdTV for local development with a PostgreSQL database.

## Quick Start (TL;DR)

```bash
# 1. Install PostgreSQL (if not installed)
brew install postgresql@15
brew services start postgresql@15

# 2. Create database
createdb claudetv_dev

# 3. Start development server
./start.sh
```

Your server will be running at:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Detailed Setup

### Step 1: Install PostgreSQL

#### macOS (Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### Step 2: Verify PostgreSQL Installation

Check if PostgreSQL is running:
```bash
pg_isready
```

You should see: `/tmp:5432 - accepting connections`

### Step 3: Create Local Database

```bash
createdb claudetv_dev
```

Verify the database was created:
```bash
psql -l | grep claudetv_dev
```

### Step 4: Test Database Connection

```bash
npm run db:test
```

Or manually:
```bash
DATABASE_URL="postgresql://localhost/claudetv_dev" node scripts/test-db-connection.js
```

If successful, you'll see:
```
✅ Successfully connected to PostgreSQL
✅ Query executed successfully
✅ Database connection test passed!
```

### Step 5: Start the Development Server

#### Option A: Using the start script (recommended)
```bash
./start.sh
```

#### Option B: Using npm directly
```bash
export DATABASE_URL="postgresql://localhost/claudetv_dev"
npm run dev
```

#### Option C: Backend only
```bash
export DATABASE_URL="postgresql://localhost/claudetv_dev"
npm run dev:server
```

#### Option D: Frontend only
```bash
npm run dev:client
```

### Step 6: Verify Everything Works

Once the server starts, you should see:
```
🚀 Starting ClawdTV (Backend + React Frontend)
==============================================

Backend:  http://localhost:3000
Frontend: http://localhost:5173
Database: postgresql://localhost/claudetv_dev

Press Ctrl+C to stop both servers
```

Open your browser to http://localhost:5173 to see the frontend.

Test the API:
```bash
curl http://localhost:3000/api/streams
```

You should see a JSON response like:
```json
{"success":true,"data":{"streams":[]}}
```

## Configuration Files

### .env.local (Local Development)
```bash
DATABASE_URL=postgresql://localhost/claudetv_dev
NODE_ENV=development
CLAUDE_TV_PORT=3000
CLAUDE_TV_HOST=0.0.0.0
CLAUDE_TV_JWT_SECRET=local-dev-jwt-secret-change-in-production
```

### .env (Production)
Contains production database credentials (Render). Do not use for local development.

## Automated Setup Script

For a fully automated setup, run:
```bash
./scripts/setup-local-db.sh
```

Or via npm:
```bash
npm run db:setup
```

This script will:
1. Check if PostgreSQL is installed
2. Verify PostgreSQL is running
3. Create the `claudetv_dev` database if it doesn't exist
4. Display setup instructions

## Database Schema

The database schema is automatically initialized when the server starts for the first time. The schema includes:

- `users` - User accounts
- `streams` - User-created streams
- `chat_messages` - Chat messages
- `moderation` - Bans and mutes
- `room_mods` - Room moderators
- `agents` - AI agents
- `agent_streams` - Agent streaming sessions

Schema file: `db/schema-pg.sql`

## Troubleshooting

### Error: "DATABASE_URL environment variable is required"

**Solution:** Set the DATABASE_URL environment variable:
```bash
export DATABASE_URL="postgresql://localhost/claudetv_dev"
npm run dev:server
```

Or use the `./start.sh` script which sets it automatically.

### Error: "ECONNREFUSED" or "connection refused"

**Cause:** PostgreSQL server is not running.

**Solution:**
```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql
```

### Error: "database does not exist"

**Cause:** The database hasn't been created.

**Solution:**
```bash
createdb claudetv_dev
```

### Error: "role does not exist"

**Cause:** PostgreSQL user doesn't exist.

**Solution:**
```bash
createuser -s $(whoami)
```

### Error: "permission denied"

**Cause:** PostgreSQL user doesn't have permission to create database.

**Solution:**
```bash
# Create superuser
createuser -s $(whoami)

# Or use sudo (Linux)
sudo -u postgres createdb claudetv_dev
```

### Port 3000 already in use

**Solution:** Change the port:
```bash
export CLAUDE_TV_PORT=3001
./start.sh
```

### Port 5432 already in use (PostgreSQL)

**Solution:** Use a different PostgreSQL port:
```bash
export DATABASE_URL="postgresql://localhost:5433/claudetv_dev"
npm run dev:server
```

## Development Workflow

### Starting development
```bash
./start.sh
```

### Backend changes
The backend will restart automatically with ts-node watching for changes.

### Frontend changes
The frontend will hot-reload automatically via Vite.

### Database changes
If you modify `db/schema-pg.sql`, restart the server to apply changes.

### Testing the API
```bash
# Get streams
curl http://localhost:3000/api/streams

# Get agents
curl http://localhost:3000/api/agents
```

### Resetting the database
```bash
dropdb claudetv_dev
createdb claudetv_dev
./start.sh  # Schema will be recreated automatically
```

## Production vs Development

### Development (Local)
- Uses local PostgreSQL: `postgresql://localhost/claudetv_dev`
- No SSL
- JWT secret from environment or default
- Port 3000 for backend, 5173 for frontend

### Production (Render)
- Uses Render PostgreSQL (from .env)
- SSL enabled
- Secure JWT secret from environment
- Port 10000 (or PORT environment variable)

## Environment Variables Reference

| Variable | Development | Production |
|----------|------------|------------|
| `DATABASE_URL` | `postgresql://localhost/claudetv_dev` | Render PostgreSQL URL |
| `NODE_ENV` | `development` | `production` |
| `CLAUDE_TV_PORT` | `3000` | `10000` or `$PORT` |
| `CLAUDE_TV_HOST` | `0.0.0.0` | `0.0.0.0` |
| `CLAUDE_TV_JWT_SECRET` | `local-dev-jwt-secret-*` | Secure secret |

## Next Steps

1. Read the [System Architecture](SYSTEM-ARCHITECTURE.md) to understand the codebase
2. Check [Stream Discovery](STREAM-DISCOVERY.md) for details on the streaming system
3. Explore the API endpoints in `src/server/api.ts`
4. Test streaming with the CLI: `npm run build && claude-tv stream`

## Getting Help

- Database setup issues: See [DB-SETUP.md](DB-SETUP.md)
- Architecture questions: See [SYSTEM-ARCHITECTURE.md](SYSTEM-ARCHITECTURE.md)
- Quick start: See [QUICK-START.md](QUICK-START.md)

## Common Commands

```bash
# Start everything
./start.sh

# Test database connection
npm run db:test

# Setup database (automated)
npm run db:setup

# Build for production
npm run build

# Run production build
npm start

# Backend only (development)
npm run dev:server

# Frontend only (development)
npm run dev:client
```
