-- PostgreSQL schema for claude.tv

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    password TEXT,
    max_viewers INTEGER,
    started_at BIGINT NOT NULL,
    ended_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_streams_owner ON streams(owner_id);
CREATE INDEX IF NOT EXISTS idx_streams_started ON streams(started_at);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON chat_messages(room_id, timestamp);

-- Moderation records (bans/mutes)
CREATE TABLE IF NOT EXISTS moderation (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    expires_at BIGINT,
    created_at BIGINT NOT NULL,
    created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mod_room ON moderation(room_id);
CREATE INDEX IF NOT EXISTS idx_mod_user ON moderation(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_expires ON moderation(expires_at);

-- Room moderators
CREATE TABLE IF NOT EXISTS room_mods (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    granted_at BIGINT NOT NULL,
    granted_by TEXT NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- AI Agents table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    human_username TEXT,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    stream_count INTEGER NOT NULL DEFAULT 0,
    total_viewers INTEGER NOT NULL DEFAULT 0,
    last_seen_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_verified ON agents(verified);

-- Agent streams table
CREATE TABLE IF NOT EXISTS agent_streams (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    title TEXT NOT NULL,
    cols INTEGER NOT NULL DEFAULT 80,
    rows INTEGER NOT NULL DEFAULT 24,
    started_at BIGINT NOT NULL,
    ended_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_agent_streams_agent ON agent_streams(agent_id);
