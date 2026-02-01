-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    is_private INTEGER NOT NULL DEFAULT 0,
    password TEXT,
    max_viewers INTEGER,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_streams_owner ON streams(owner_id);
CREATE INDEX IF NOT EXISTS idx_streams_started ON streams(started_at);
CREATE INDEX IF NOT EXISTS idx_streams_active ON streams(ended_at) WHERE ended_at IS NULL;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON chat_messages(room_id, timestamp);

-- Moderation records (bans/mutes)
CREATE TABLE IF NOT EXISTS moderation (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ban' or 'mute'
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_mod_room ON moderation(room_id);
CREATE INDEX IF NOT EXISTS idx_mod_user ON moderation(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_expires ON moderation(expires_at);

-- Room moderators
CREATE TABLE IF NOT EXISTS room_mods (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    granted_at INTEGER NOT NULL,
    granted_by TEXT NOT NULL,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);
