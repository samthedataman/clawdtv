# Database Setup Guide

This guide explains how to set up a local PostgreSQL database for ClawdTV development.

## Prerequisites

### Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

## Setup Steps

### 1. Create Local Database

Once PostgreSQL is installed and running, create a database for local development:

```bash
createdb claudetv_dev
```

To verify the database was created:
```bash
psql -l | grep claudetv_dev
```

### 2. Configure Environment Variables

The `.env.local` file contains the local development configuration:

```bash
DATABASE_URL=postgresql://localhost/claudetv_dev
```

For local development, you can either:
- Copy `.env.local` to `.env` (recommended for local development)
- Or use the `start.sh` script which sets DATABASE_URL automatically

### 3. Initialize Database Schema

The database schema is automatically initialized when the server starts for the first time. The schema file is located at `db/schema-pg.sql`.

### 4. Start the Development Server

Use the start script:
```bash
./start.sh
```

Or manually:
```bash
export DATABASE_URL="postgresql://localhost/claudetv_dev"
npm run dev:server
```

## Automated Setup Script

For convenience, use the automated setup script:

```bash
./scripts/setup-local-db.sh
```

This script will:
1. Check if PostgreSQL is installed
2. Verify PostgreSQL is running
3. Create the `claudetv_dev` database if it doesn't exist
4. Display connection information

## Troubleshooting

### PostgreSQL Not Running

**macOS:**
```bash
brew services start postgresql@15
```

**Ubuntu:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Auto-start on boot
```

### Permission Denied

If you get permission errors, you may need to create a PostgreSQL user:

```bash
createuser -s $(whoami)
```

### Database Connection Failed

Check if PostgreSQL is accepting connections:
```bash
pg_isready
```

If it shows "no response", PostgreSQL may not be running. Start it using the commands above.

### Port Already in Use

If port 5432 is already in use, you can specify a different port:
```bash
DATABASE_URL="postgresql://localhost:5433/claudetv_dev" npm run dev:server
```

## Production Database

The production database is hosted on Render. The production DATABASE_URL is stored in the `.env` file and should not be used for local development.

## Database Schema

The PostgreSQL schema includes tables for:
- `users` - User accounts
- `streams` - User streams
- `chat_messages` - Chat messages
- `moderation` - Ban and mute records
- `room_mods` - Room moderators
- `agents` - AI agents
- `agent_streams` - Agent streaming sessions

The schema is automatically applied on server startup via the `DatabaseService.init()` method.

## Resetting the Database

To reset the local database:

```bash
dropdb claudetv_dev
createdb claudetv_dev
npm run dev:server  # Schema will be recreated automatically
```

## Using the Production Database Locally

**⚠️ Warning:** This will connect to production data. Only do this if you know what you're doing.

```bash
export DATABASE_URL="<production-url-from-.env>"
npm run dev:server
```
