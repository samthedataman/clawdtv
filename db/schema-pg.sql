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
    ended_at BIGINT,
    peak_viewers INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_streams_agent ON agent_streams(agent_id);

-- Waitlist for users who want hosted agents
CREATE TABLE IF NOT EXISTS waitlist (
    id TEXT PRIMARY KEY,
    x_handle TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_handle ON waitlist(x_handle);

-- Migration: Add peak_viewers column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_streams' AND column_name = 'peak_viewers') THEN
        ALTER TABLE agent_streams ADD COLUMN peak_viewers INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Migration: Add profile fields to agents table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'bio') THEN
        ALTER TABLE agents ADD COLUMN bio TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'avatar_url') THEN
        ALTER TABLE agents ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'website_url') THEN
        ALTER TABLE agents ADD COLUMN website_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'social_links') THEN
        ALTER TABLE agents ADD COLUMN social_links JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'follower_count') THEN
        ALTER TABLE agents ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Agent follows table (for follow/unfollow functionality)
CREATE TABLE IF NOT EXISTS agent_follows (
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_follows_follower ON agent_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_agent_follows_following ON agent_follows(following_id);

-- Migration: Add CTV coin balance to agents
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'coin_balance') THEN
        ALTER TABLE agents ADD COLUMN coin_balance INTEGER NOT NULL DEFAULT 100;
    END IF;
END $$;

-- CTV Coin transactions table
CREATE TABLE IF NOT EXISTS coin_transactions (
    id TEXT PRIMARY KEY,
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL, -- 'tip', 'poke', 'reward'
    message TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_from ON coin_transactions(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_to ON coin_transactions(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_time ON coin_transactions(created_at);

-- Agent pokes table (fun social interactions)
CREATE TABLE IF NOT EXISTS agent_pokes (
    id TEXT PRIMARY KEY,
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT NOT NULL,
    poke_type TEXT NOT NULL, -- 'poke', 'wave', 'high-five', 'salute'
    message TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pokes_from ON agent_pokes(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_pokes_to ON agent_pokes(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_pokes_time ON agent_pokes(created_at);

-- News votes table (upvote/downvote on news articles)
CREATE TABLE IF NOT EXISTS news_votes (
    id TEXT PRIMARY KEY,
    article_url_hash TEXT NOT NULL,  -- SHA256 hash of article URL
    article_url TEXT NOT NULL,
    article_title TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    vote INTEGER NOT NULL,  -- 1 for upvote, -1 for downvote
    created_at BIGINT NOT NULL,
    UNIQUE(article_url_hash, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_news_votes_article ON news_votes(article_url_hash);
CREATE INDEX IF NOT EXISTS idx_news_votes_agent ON news_votes(agent_id);

-- News comments table
CREATE TABLE IF NOT EXISTS news_comments (
    id TEXT PRIMARY KEY,
    article_url_hash TEXT NOT NULL,
    article_url TEXT NOT NULL,
    article_title TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_comments_article ON news_comments(article_url_hash);
CREATE INDEX IF NOT EXISTS idx_news_comments_agent ON news_comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_time ON news_comments(created_at);

-- CTV withdrawal requests table
CREATE TABLE IF NOT EXISTS ctv_withdrawals (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,  -- Solana wallet address
    amount BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    tx_hash TEXT,  -- Solana transaction hash once completed
    created_at BIGINT NOT NULL,
    processed_at BIGINT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_agent ON ctv_withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON ctv_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_time ON ctv_withdrawals(created_at);

-- Add wallet_address column to agents table if not exists
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Chat message reactions table (thumbs up/down on chat messages)
CREATE TABLE IF NOT EXISTS chat_reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reaction TEXT NOT NULL,  -- 'thumbs_up' or 'thumbs_down'
    created_at BIGINT NOT NULL,
    UNIQUE(message_id, user_id)  -- One reaction per user per message
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_room ON chat_reactions(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_user ON chat_reactions(user_id);
