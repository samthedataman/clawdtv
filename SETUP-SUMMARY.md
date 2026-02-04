# Local Database Setup - Summary

## What Was Done

### 1. Database Configuration Analysis
- Examined `/Users/samsavage/claudetv/src/server/database.ts`
- Confirmed the backend requires PostgreSQL (not SQLite)
- Database URL must start with `postgresql://` or `postgres://`
- Schema located at `/Users/samsavage/claudetv/db/schema-pg.sql`

### 2. Updated start.sh Script
**File:** `/Users/samsavage/claudetv/start.sh`

**Changes:**
- Loads `.env.local` for local development settings (if exists)
- Falls back to `.env` for configuration
- Sets default `DATABASE_URL=postgresql://localhost/claudetv_dev`
- Displays helpful setup instructions if no DATABASE_URL is found
- Shows database URL being used when starting

### 3. Created Database Setup Scripts

#### Setup Script
**File:** `/Users/samsavage/claudetv/scripts/setup-local-db.sh`
- Checks if PostgreSQL is installed
- Verifies PostgreSQL is running
- Creates `claudetv_dev` database if it doesn't exist
- Provides platform-specific installation instructions

**Usage:**
```bash
./scripts/setup-local-db.sh
# or
npm run db:setup
```

#### Database Connection Test
**File:** `/Users/samsavage/claudetv/scripts/test-db-connection.js`
- Tests PostgreSQL connection
- Displays server version and current time
- Lists existing tables
- Provides helpful error messages for common issues

**Usage:**
```bash
npm run db:test
# or
DATABASE_URL="postgresql://localhost/claudetv_dev" node scripts/test-db-connection.js
```

#### Setup Verification Script
**File:** `/Users/samsavage/claudetv/scripts/verify-setup.sh`
- Comprehensive checks for all prerequisites
- Verifies Node.js, npm, PostgreSQL installation
- Checks database exists and is accessible
- Tests project dependencies
- Color-coded output (✅, ⚠️, ❌)

**Usage:**
```bash
npm run verify
# or
./scripts/verify-setup.sh
```

### 4. Created Configuration Files

#### Local Development Config
**File:** `/Users/samsavage/claudetv/.env.local`
```bash
DATABASE_URL=postgresql://localhost/claudetv_dev
NODE_ENV=development
CLAUDE_TV_PORT=3000
CLAUDE_TV_HOST=0.0.0.0
CLAUDE_TV_JWT_SECRET=local-dev-jwt-secret-change-in-production
```

This file can be copied to `.env` for persistent configuration.

### 5. Updated package.json Scripts

Added helpful npm scripts:
```json
{
  "db:test": "node scripts/test-db-connection.js",
  "db:setup": "./scripts/setup-local-db.sh",
  "verify": "./scripts/verify-setup.sh"
}
```

### 6. Created Comprehensive Documentation

#### LOCAL-DEV-SETUP.md
**File:** `/Users/samsavage/claudetv/LOCAL-DEV-SETUP.md`
- Complete local development setup guide
- Step-by-step PostgreSQL installation (macOS, Linux, Windows)
- Database creation and initialization
- Troubleshooting common issues
- Development workflow tips
- Environment variables reference

#### DB-SETUP.md
**File:** `/Users/samsavage/claudetv/DB-SETUP.md`
- Focused database setup instructions
- PostgreSQL installation guides
- Database schema information
- Connection troubleshooting
- Production vs development configuration

#### DEV-COMMANDS.md
**File:** `/Users/samsavage/claudetv/DEV-COMMANDS.md`
- Quick reference for all developer commands
- Database management commands
- PostgreSQL service control
- Testing commands
- Troubleshooting tips
- Common issues and fixes

### 7. Updated README.md
**File:** `/Users/samsavage/claudetv/README.md`
- Added "For Local Development" section
- Quick setup instructions (3 steps)
- Links to detailed documentation

## How to Use This Setup

### Quick Start (3 Steps)

```bash
# 1. Install and start PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# 2. Create database
createdb claudetv_dev

# 3. Start development server
./start.sh
```

### Verify Everything Works

```bash
npm run verify
```

This will check:
- ✅ Node.js installed (>= 18)
- ✅ PostgreSQL installed and running
- ✅ Database exists
- ✅ Dependencies installed
- ✅ Configuration files present
- ✅ Database connection successful

### Start Development

```bash
./start.sh
```

This will:
1. Load environment variables from `.env.local` or `.env`
2. Set default DATABASE_URL if not configured
3. Start backend on http://localhost:3000
4. Start frontend on http://localhost:5173
5. Display database connection info

### Test Backend

```bash
# Test database connection
npm run db:test

# Start backend only
npm run dev:server

# Test API
curl http://localhost:3000/api/streams
curl http://localhost:3000/api/agents
```

## Architecture Notes

### Database Flow
1. Server starts → `DatabaseService` constructor reads `DATABASE_URL`
2. `DatabaseService.init()` applies schema from `db/schema-pg.sql`
3. Schema creates tables if they don't exist (idempotent)
4. Server ready to accept connections

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `CLAUDE_TV_PORT` - Server port (default: 3000)
- `CLAUDE_TV_HOST` - Bind address (default: 0.0.0.0)
- `CLAUDE_TV_JWT_SECRET` - JWT signing key (default provided for dev)
- `NODE_ENV` - Environment (development/production)

### Database Schema
The PostgreSQL schema includes:
- `users` - User accounts (username, password hash, display name)
- `streams` - User-created streams
- `chat_messages` - Chat messages per room
- `moderation` - Bans and mutes
- `room_mods` - Room moderators
- `agents` - AI agents (with API keys)
- `agent_streams` - Agent streaming sessions

## Common Workflows

### First Time Setup
```bash
brew install postgresql@15
brew services start postgresql@15
createdb claudetv_dev
npm install
npm run verify
./start.sh
```

### Daily Development
```bash
./start.sh
# Make changes
# Backend auto-restarts via ts-node
# Frontend hot-reloads via Vite
```

### Reset Database
```bash
dropdb claudetv_dev
createdb claudetv_dev
./start.sh  # Schema recreated automatically
```

### Troubleshooting
```bash
# 1. Verify setup
npm run verify

# 2. Test database
npm run db:test

# 3. Check PostgreSQL
pg_isready

# 4. View logs
tail -f /opt/homebrew/var/log/postgresql@15.log
```

## Files Created/Modified

### Created Files
- `/Users/samsavage/claudetv/scripts/setup-local-db.sh` - Database setup script
- `/Users/samsavage/claudetv/scripts/test-db-connection.js` - Connection test
- `/Users/samsavage/claudetv/scripts/verify-setup.sh` - Setup verification
- `/Users/samsavage/claudetv/.env.local` - Local dev configuration template
- `/Users/samsavage/claudetv/LOCAL-DEV-SETUP.md` - Complete setup guide
- `/Users/samsavage/claudetv/DB-SETUP.md` - Database setup guide
- `/Users/samsavage/claudetv/DEV-COMMANDS.md` - Command reference
- `/Users/samsavage/claudetv/SETUP-SUMMARY.md` - This file

### Modified Files
- `/Users/samsavage/claudetv/start.sh` - Enhanced with env loading and better messaging
- `/Users/samsavage/claudetv/package.json` - Added db:test, db:setup, verify scripts
- `/Users/samsavage/claudetv/README.md` - Added local development section

## Next Steps

1. **Run verification:** `npm run verify`
2. **Create database:** `createdb claudetv_dev` (if not exists)
3. **Start server:** `./start.sh`
4. **Test API:** `curl http://localhost:3000/api/streams`
5. **Open frontend:** http://localhost:5173

## Documentation Index

- **[LOCAL-DEV-SETUP.md](LOCAL-DEV-SETUP.md)** - Full local development guide
- **[DB-SETUP.md](DB-SETUP.md)** - Database configuration guide
- **[DEV-COMMANDS.md](DEV-COMMANDS.md)** - Quick command reference
- **[README.md](README.md)** - Project overview
- **[SYSTEM-ARCHITECTURE.md](SYSTEM-ARCHITECTURE.md)** - Architecture details
- **[QUICK-START.md](QUICK-START.md)** - Getting started guide

## Support

If you encounter issues:

1. Check [LOCAL-DEV-SETUP.md](LOCAL-DEV-SETUP.md) troubleshooting section
2. Run `npm run verify` to diagnose issues
3. Check [DEV-COMMANDS.md](DEV-COMMANDS.md) for common fixes
4. Review PostgreSQL logs: `tail -f /opt/homebrew/var/log/postgresql@15.log`

## Summary

The backend now requires a PostgreSQL database to start. The setup has been automated with:

✅ Scripts to create and verify database
✅ Environment configuration templates
✅ Enhanced start.sh with automatic configuration
✅ Comprehensive documentation
✅ npm scripts for common tasks
✅ Troubleshooting guides

**Run `npm run verify` to check your setup, then `./start.sh` to begin!**
