import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
export class DatabaseService {
    pool;
    constructor(connectionString) {
        // Use DATABASE_URL from environment (Render provides this)
        const dbUrl = connectionString || process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('DATABASE_URL environment variable is required');
        }
        // Validate it looks like a PostgreSQL URL
        if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
            console.error('='.repeat(60));
            console.error('INVALID DATABASE_URL');
            console.error('='.repeat(60));
            console.error(`Got: "${dbUrl}"`);
            console.error('');
            console.error('Expected format: postgresql://user:password@host/database');
            console.error('');
            console.error('Fix in Render Dashboard:');
            console.error('1. Go to your claude-tv service');
            console.error('2. Click Environment tab');
            console.error('3. Set DATABASE_URL to your PostgreSQL connection string');
            console.error('='.repeat(60));
            throw new Error(`DATABASE_URL must start with postgresql:// or postgres://, got: "${dbUrl.slice(0, 20)}..."`);
        }
        this.pool = new Pool({
            connectionString: dbUrl,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
    }
    async init() {
        // Run schema
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const schemaPath = path.join(__dirname, '../../db/schema-pg.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        await this.pool.query(schema);
        console.log('PostgreSQL database initialized');
    }
    // User operations
    async createUser(username, passwordHash, displayName) {
        const id = uuidv4();
        const createdAt = Date.now();
        await this.pool.query(`INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES ($1, $2, $3, $4, $5)`, [id, username, passwordHash, displayName || null, createdAt]);
        return { id, username, passwordHash, displayName, createdAt };
    }
    async getUserById(id) {
        const result = await this.pool.query(`SELECT id, username, password_hash as "passwordHash", display_name as "displayName", created_at as "createdAt" FROM users WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }
    async getUserByUsername(username) {
        const result = await this.pool.query(`SELECT id, username, password_hash as "passwordHash", display_name as "displayName", created_at as "createdAt" FROM users WHERE username = $1`, [username]);
        return result.rows[0] || null;
    }
    async updateUser(id, updates) {
        const result = await this.pool.query(`UPDATE users SET display_name = COALESCE($1, display_name) WHERE id = $2`, [updates.displayName || null, id]);
        return (result.rowCount || 0) > 0;
    }
    toUserPublic(user) {
        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            createdAt: user.createdAt,
        };
    }
    // Stream operations
    async createStream(ownerId, title, isPrivate, password, maxViewers) {
        const id = uuidv4();
        const startedAt = Date.now();
        await this.pool.query(`INSERT INTO streams (id, owner_id, title, is_private, password, max_viewers, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, ownerId, title, isPrivate, password || null, maxViewers || null, startedAt]);
        return { id, ownerId, title, isPrivate, password, maxViewers, startedAt };
    }
    async getStreamById(id) {
        const result = await this.pool.query(`SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }
    async getActiveStreams() {
        const result = await this.pool.query(`SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE ended_at IS NULL ORDER BY started_at DESC`);
        return result.rows;
    }
    async getPublicActiveStreams() {
        const result = await this.pool.query(`SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE ended_at IS NULL AND is_private = false ORDER BY started_at DESC`);
        return result.rows;
    }
    async endStream(id) {
        const result = await this.pool.query(`UPDATE streams SET ended_at = $1 WHERE id = $2 AND ended_at IS NULL`, [Date.now(), id]);
        return (result.rowCount || 0) > 0;
    }
    // Chat message operations
    async saveMessage(roomId, userId, username, content, role, gifUrl) {
        const id = uuidv4();
        const timestamp = Date.now();
        await this.pool.query(`INSERT INTO chat_messages (id, room_id, user_id, username, content, role, timestamp, gif_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, roomId, userId, username, content, role, timestamp, gifUrl || null]);
        return { id, roomId, userId, username, content, role, timestamp, gifUrl };
    }
    async getRecentMessages(roomId, limit = 50) {
        const result = await this.pool.query(`SELECT id, room_id as "roomId", user_id as "userId", username, content, role, timestamp, gif_url as "gifUrl"
       FROM chat_messages WHERE room_id = $1 ORDER BY timestamp DESC LIMIT $2`, [roomId, limit]);
        return result.rows.reverse();
    }
    async clearRoomMessages(roomId) {
        const result = await this.pool.query(`DELETE FROM chat_messages WHERE room_id = $1`, [roomId]);
        return result.rowCount || 0;
    }
    // Moderation operations
    async addBan(roomId, userId, type, createdBy, duration) {
        const id = uuidv4();
        const createdAt = Date.now();
        const expiresAt = duration ? createdAt + duration * 1000 : undefined;
        await this.pool.query(`INSERT INTO moderation (id, room_id, user_id, type, expires_at, created_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, roomId, userId, type, expiresAt || null, createdAt, createdBy]);
        return { id, roomId, userId, type, expiresAt, createdAt, createdBy };
    }
    async removeBan(roomId, userId, type) {
        const result = await this.pool.query(`DELETE FROM moderation WHERE room_id = $1 AND user_id = $2 AND type = $3`, [roomId, userId, type]);
        return (result.rowCount || 0) > 0;
    }
    async isUserBanned(roomId, userId) {
        const result = await this.pool.query(`SELECT 1 FROM moderation WHERE room_id = $1 AND user_id = $2 AND type = 'ban' AND (expires_at IS NULL OR expires_at > $3)`, [roomId, userId, Date.now()]);
        return result.rows.length > 0;
    }
    async isUserMuted(roomId, userId) {
        const result = await this.pool.query(`SELECT 1 FROM moderation WHERE room_id = $1 AND user_id = $2 AND type = 'mute' AND (expires_at IS NULL OR expires_at > $3)`, [roomId, userId, Date.now()]);
        return result.rows.length > 0;
    }
    async getActiveBans(roomId) {
        const result = await this.pool.query(`SELECT id, room_id as "roomId", user_id as "userId", type, expires_at as "expiresAt",
              created_at as "createdAt", created_by as "createdBy"
       FROM moderation WHERE room_id = $1 AND (expires_at IS NULL OR expires_at > $2)`, [roomId, Date.now()]);
        return result.rows;
    }
    async cleanExpiredBans() {
        const result = await this.pool.query(`DELETE FROM moderation WHERE expires_at IS NOT NULL AND expires_at < $1`, [Date.now()]);
        return result.rowCount || 0;
    }
    // Room moderator operations
    async addMod(roomId, userId, grantedBy) {
        await this.pool.query(`INSERT INTO room_mods (room_id, user_id, granted_at, granted_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (room_id, user_id) DO UPDATE SET granted_at = $3, granted_by = $4`, [roomId, userId, Date.now(), grantedBy]);
    }
    async removeMod(roomId, userId) {
        const result = await this.pool.query(`DELETE FROM room_mods WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
        return (result.rowCount || 0) > 0;
    }
    async isMod(roomId, userId) {
        const result = await this.pool.query(`SELECT 1 FROM room_mods WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
        return result.rows.length > 0;
    }
    async getRoomMods(roomId) {
        const result = await this.pool.query(`SELECT user_id FROM room_mods WHERE room_id = $1`, [roomId]);
        return result.rows.map(row => row.user_id);
    }
    // Agent operations
    async createAgent(name) {
        const id = uuidv4();
        const apiKey = 'ctv_' + crypto.randomBytes(32).toString('hex');
        const now = Date.now();
        await this.pool.query(`INSERT INTO agents (id, name, api_key, verified, stream_count, total_viewers, last_seen_at, created_at) VALUES ($1, $2, $3, false, 0, 0, $4, $5)`, [id, name, apiKey, now, now]);
        return {
            id,
            name,
            apiKey,
            verified: false,
            streamCount: 0,
            totalViewers: 0,
            lastSeenAt: now,
            createdAt: now,
        };
    }
    async getAgentByApiKey(apiKey) {
        const result = await this.pool.query(`SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount",
              COALESCE(coin_balance, 100) as "coinBalance"
       FROM agents WHERE api_key = $1`, [apiKey]);
        return result.rows[0] || null;
    }
    async getAgentById(id) {
        const result = await this.pool.query(`SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount",
              COALESCE(coin_balance, 100) as "coinBalance"
       FROM agents WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }
    async getAllAgents() {
        const result = await this.pool.query(`SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount"
       FROM agents ORDER BY last_seen_at DESC`);
        return result.rows;
    }
    async getRecentAgents(limit = 20) {
        const result = await this.pool.query(`SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount"
       FROM agents ORDER BY last_seen_at DESC LIMIT $1`, [limit]);
        return result.rows;
    }
    async updateAgentLastSeen(id) {
        await this.pool.query(`UPDATE agents SET last_seen_at = $1 WHERE id = $2`, [Date.now(), id]);
    }
    async claimAgent(agentId, humanUsername) {
        const result = await this.pool.query(`UPDATE agents SET human_username = $1, verified = true WHERE id = $2`, [humanUsername, agentId]);
        return (result.rowCount || 0) > 0;
    }
    async incrementAgentStreamCount(agentId) {
        await this.pool.query(`UPDATE agents SET stream_count = stream_count + 1 WHERE id = $1`, [agentId]);
    }
    async incrementAgentViewers(agentId, count) {
        await this.pool.query(`UPDATE agents SET total_viewers = total_viewers + $1 WHERE id = $2`, [count, agentId]);
    }
    // Update peak viewers for an agent stream if current count is higher
    async updateStreamPeakViewers(roomId, currentViewers) {
        await this.pool.query(`UPDATE agent_streams SET peak_viewers = GREATEST(COALESCE(peak_viewers, 0), $1) WHERE room_id = $2 AND ended_at IS NULL`, [currentViewers, roomId]);
    }
    // Agent stream operations
    async createAgentStream(agentId, roomId, title, cols = 80, rows = 24) {
        const id = uuidv4();
        const startedAt = Date.now();
        await this.pool.query(`INSERT INTO agent_streams (id, agent_id, room_id, title, cols, rows, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, agentId, roomId, title, cols, rows, startedAt]);
        return { id, agentId, roomId, title, cols, rows, startedAt, peakViewers: 0 };
    }
    async getActiveAgentStream(agentId) {
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
       FROM agent_streams WHERE agent_id = $1 AND ended_at IS NULL`, [agentId]);
        return result.rows[0] || null;
    }
    async getActiveAgentStreams() {
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
       FROM agent_streams WHERE ended_at IS NULL`);
        return result.rows;
    }
    async getActiveAgentStreamsWithAgentInfo() {
        const staleThreshold = Date.now() - 120000; // 2 minutes
        const result = await this.pool.query(`SELECT
         s.id, s.agent_id as "agentId", s.room_id as "roomId", s.title, s.cols, s.rows,
         s.started_at as "startedAt", s.ended_at as "endedAt", COALESCE(s.peak_viewers, 0) as "peakViewers",
         a.name as "agentName", a.verified
       FROM agent_streams s
       JOIN agents a ON s.agent_id = a.id
       WHERE s.ended_at IS NULL AND a.last_seen_at > $1
       ORDER BY s.started_at DESC`, [staleThreshold]);
        return result.rows;
    }
    async endAgentStream(streamId) {
        const result = await this.pool.query(`UPDATE agent_streams SET ended_at = $1 WHERE id = $2`, [Date.now(), streamId]);
        return (result.rowCount || 0) > 0;
    }
    async endStaleAgentStreams(inactivityThresholdMs = 120000) {
        const staleThreshold = Date.now() - inactivityThresholdMs;
        const result = await this.pool.query(`UPDATE agent_streams SET ended_at = $1
       WHERE ended_at IS NULL
       AND agent_id IN (SELECT id FROM agents WHERE last_seen_at < $2)`, [Date.now(), staleThreshold]);
        const count = result.rowCount || 0;
        if (count > 0) {
            console.log(`[DB] Ended ${count} stale agent stream(s)`);
        }
        return count;
    }
    async getAgentStreamByRoomId(roomId) {
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
       FROM agent_streams WHERE room_id = $1`, [roomId]);
        return result.rows[0] || null;
    }
    // History/Archive operations
    async getEndedAgentStreams(limit = 20, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM agent_streams WHERE ended_at IS NOT NULL`);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
       FROM agent_streams WHERE ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        return { streams: result.rows, total };
    }
    async getEndedStreams(limit = 20, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM streams WHERE ended_at IS NOT NULL`);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        return { streams: result.rows, total };
    }
    async getAllMessagesForRoom(roomId, limit = 500, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM chat_messages WHERE room_id = $1`, [roomId]);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT id, room_id as "roomId", user_id as "userId", username, content, role, timestamp
       FROM chat_messages WHERE room_id = $1 ORDER BY timestamp ASC LIMIT $2 OFFSET $3`, [roomId, limit, offset]);
        return { messages: result.rows, total };
    }
    async getAgentStreamsByAgentId(agentId, limit = 20, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM agent_streams WHERE agent_id = $1 AND ended_at IS NOT NULL`, [agentId]);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
       FROM agent_streams WHERE agent_id = $1 AND ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT $2 OFFSET $3`, [agentId, limit, offset]);
        return { streams: result.rows, total };
    }
    toAgentPublic(agent, isStreaming = false) {
        return {
            id: agent.id,
            name: agent.name,
            verified: agent.verified,
            streamCount: agent.streamCount,
            isStreaming,
            lastSeenAt: agent.lastSeenAt,
            createdAt: agent.createdAt,
            bio: agent.bio,
            avatarUrl: agent.avatarUrl,
            websiteUrl: agent.websiteUrl,
            socialLinks: agent.socialLinks,
            followerCount: agent.followerCount,
            coinBalance: agent.coinBalance,
        };
    }
    // Agent profile operations
    async updateAgentProfile(agentId, updates) {
        const result = await this.pool.query(`UPDATE agents SET
         bio = COALESCE($1, bio),
         avatar_url = COALESCE($2, avatar_url),
         website_url = COALESCE($3, website_url),
         social_links = COALESCE($4, social_links)
       WHERE id = $5`, [
            updates.bio || null,
            updates.avatarUrl || null,
            updates.websiteUrl || null,
            updates.socialLinks ? JSON.stringify(updates.socialLinks) : null,
            agentId
        ]);
        return (result.rowCount || 0) > 0;
    }
    // Agent follow operations
    async followAgent(followerId, followingId) {
        try {
            await this.pool.query(`INSERT INTO agent_follows (follower_id, following_id, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (follower_id, following_id) DO NOTHING`, [followerId, followingId, Date.now()]);
            // Update follower count
            await this.pool.query(`UPDATE agents SET follower_count = (
           SELECT COUNT(*) FROM agent_follows WHERE following_id = $1
         ) WHERE id = $1`, [followingId]);
            return true;
        }
        catch {
            return false;
        }
    }
    async unfollowAgent(followerId, followingId) {
        const result = await this.pool.query(`DELETE FROM agent_follows WHERE follower_id = $1 AND following_id = $2`, [followerId, followingId]);
        // Update follower count
        await this.pool.query(`UPDATE agents SET follower_count = (
         SELECT COUNT(*) FROM agent_follows WHERE following_id = $1
       ) WHERE id = $1`, [followingId]);
        return (result.rowCount || 0) > 0;
    }
    async isFollowing(followerId, followingId) {
        const result = await this.pool.query(`SELECT 1 FROM agent_follows WHERE follower_id = $1 AND following_id = $2`, [followerId, followingId]);
        return result.rows.length > 0;
    }
    async getAgentFollowers(agentId, limit = 50, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM agent_follows WHERE following_id = $1`, [agentId]);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT a.id, a.name, a.verified, a.stream_count as "streamCount",
              a.last_seen_at as "lastSeenAt", a.created_at as "createdAt",
              a.bio, a.avatar_url as "avatarUrl"
       FROM agents a
       JOIN agent_follows f ON a.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`, [agentId, limit, offset]);
        const followers = result.rows.map((r) => ({
            ...r,
            isStreaming: false,
        }));
        return { followers, total };
    }
    async getAgentFollowing(agentId, limit = 50, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM agent_follows WHERE follower_id = $1`, [agentId]);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT a.id, a.name, a.verified, a.stream_count as "streamCount",
              a.last_seen_at as "lastSeenAt", a.created_at as "createdAt",
              a.bio, a.avatar_url as "avatarUrl"
       FROM agents a
       JOIN agent_follows f ON a.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`, [agentId, limit, offset]);
        const following = result.rows.map((r) => ({
            ...r,
            isStreaming: false,
        }));
        return { following, total };
    }
    // ============================================
    // CTV COINS & TIPPING
    // ============================================
    async getAgentBalance(agentId) {
        const result = await this.pool.query(`SELECT COALESCE(coin_balance, 100) as balance FROM agents WHERE id = $1`, [agentId]);
        return result.rows[0]?.balance ?? 100;
    }
    async tipAgent(fromAgentId, toAgentId, amount, message) {
        // Validate amount
        if (amount <= 0) {
            return { success: false, error: 'Amount must be positive' };
        }
        if (amount > 1000) {
            return { success: false, error: 'Maximum tip is 1000 CTV' };
        }
        if (fromAgentId === toAgentId) {
            return { success: false, error: 'Cannot tip yourself' };
        }
        // Check balance
        const balance = await this.getAgentBalance(fromAgentId);
        if (balance < amount) {
            return { success: false, error: `Insufficient balance (have ${balance}, need ${amount})` };
        }
        // Perform transfer atomically
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Deduct from sender
            await client.query(`UPDATE agents SET coin_balance = COALESCE(coin_balance, 100) - $1 WHERE id = $2`, [amount, fromAgentId]);
            // Add to receiver
            await client.query(`UPDATE agents SET coin_balance = COALESCE(coin_balance, 100) + $1 WHERE id = $2`, [amount, toAgentId]);
            // Record transaction
            const txId = uuidv4();
            const now = Date.now();
            await client.query(`INSERT INTO coin_transactions (id, from_agent_id, to_agent_id, amount, transaction_type, message, created_at)
         VALUES ($1, $2, $3, $4, 'tip', $5, $6)`, [txId, fromAgentId, toAgentId, amount, message || null, now]);
            await client.query('COMMIT');
            return {
                success: true,
                transaction: {
                    id: txId,
                    fromAgentId,
                    toAgentId,
                    amount,
                    transactionType: 'tip',
                    message,
                    createdAt: now,
                },
            };
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('Tip transaction failed:', err);
            return { success: false, error: 'Transaction failed' };
        }
        finally {
            client.release();
        }
    }
    // Award CTV bonus to an agent (e.g., for streaming milestones)
    async creditAgentBonus(agentId, amount, reason) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Add to agent's balance
            await client.query(`UPDATE agents SET coin_balance = COALESCE(coin_balance, 100) + $1 WHERE id = $2`, [amount, agentId]);
            // Record transaction (from system, to agent)
            const txId = uuidv4();
            const now = Date.now();
            await client.query(`INSERT INTO coin_transactions (id, from_agent_id, to_agent_id, amount, transaction_type, message, created_at)
         VALUES ($1, 'system', $2, $3, 'bonus', $4, $5)`, [txId, agentId, amount, reason, now]);
            await client.query('COMMIT');
            console.log(`[CTV] Awarded ${amount} CTV to ${agentId}: ${reason}`);
            return {
                success: true,
                transaction: {
                    id: txId,
                    fromAgentId: 'system',
                    toAgentId: agentId,
                    amount,
                    transactionType: 'bonus',
                    message: reason,
                    createdAt: now,
                },
            };
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('Bonus credit failed:', err);
            return { success: false };
        }
        finally {
            client.release();
        }
    }
    async getAgentTransactions(agentId, limit = 50, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM coin_transactions
       WHERE from_agent_id = $1 OR to_agent_id = $1`, [agentId]);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
              amount, transaction_type as "transactionType", message, created_at as "createdAt"
       FROM coin_transactions
       WHERE from_agent_id = $1 OR to_agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`, [agentId, limit, offset]);
        return { transactions: result.rows, total };
    }
    // ============================================
    // WALLET & WITHDRAWALS
    // ============================================
    // Link a Solana wallet to an agent
    async setAgentWallet(agentId, walletAddress) {
        // Basic Solana address validation (base58, 32-44 chars)
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
            return false;
        }
        await this.pool.query(`UPDATE agents SET wallet_address = $1 WHERE id = $2`, [walletAddress, agentId]);
        return true;
    }
    // Get agent's wallet address
    async getAgentWallet(agentId) {
        const result = await this.pool.query(`SELECT wallet_address FROM agents WHERE id = $1`, [agentId]);
        return result.rows[0]?.wallet_address || null;
    }
    // Request a CTV withdrawal
    async requestWithdrawal(agentId, amount) {
        // Check balance
        const balance = await this.getAgentBalance(agentId);
        if (balance < amount) {
            return { success: false, error: `Insufficient balance (have ${balance}, need ${amount})` };
        }
        // Check wallet is set
        const wallet = await this.getAgentWallet(agentId);
        if (!wallet) {
            return { success: false, error: 'No wallet address linked. Set wallet first with /api/agents/:id/wallet' };
        }
        // Minimum withdrawal
        const MIN_WITHDRAWAL = 10000;
        if (amount < MIN_WITHDRAWAL) {
            return { success: false, error: `Minimum withdrawal is ${MIN_WITHDRAWAL} CTV` };
        }
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Deduct from balance
            await client.query(`UPDATE agents SET coin_balance = coin_balance - $1 WHERE id = $2`, [amount, agentId]);
            // Create withdrawal request
            const id = uuidv4();
            const now = Date.now();
            await client.query(`INSERT INTO ctv_withdrawals (id, agent_id, wallet_address, amount, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', $5)`, [id, agentId, wallet, amount, now]);
            // Record in transactions
            await client.query(`INSERT INTO coin_transactions (id, from_agent_id, to_agent_id, amount, transaction_type, message, created_at)
         VALUES ($1, $2, 'withdrawal', $3, 'withdrawal', $4, $5)`, [uuidv4(), agentId, amount, `Withdrawal to ${wallet.slice(0, 8)}...`, now]);
            await client.query('COMMIT');
            console.log(`[CTV] Withdrawal request ${id}: ${amount} CTV from ${agentId} to ${wallet}`);
            return { success: true, withdrawalId: id };
        }
        catch (err) {
            await client.query('ROLLBACK');
            console.error('Withdrawal request failed:', err);
            return { success: false, error: 'Withdrawal request failed' };
        }
        finally {
            client.release();
        }
    }
    // Get agent's withdrawal history
    async getAgentWithdrawals(agentId, limit = 20) {
        const result = await this.pool.query(`SELECT id, wallet_address as "walletAddress", amount, status,
              tx_hash as "txHash", created_at as "createdAt", processed_at as "processedAt"
       FROM ctv_withdrawals
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2`, [agentId, limit]);
        return result.rows;
    }
    // Get all pending withdrawals (admin)
    async getPendingWithdrawals() {
        const result = await this.pool.query(`SELECT w.id, w.agent_id as "agentId", a.name as "agentName",
              w.wallet_address as "walletAddress", w.amount, w.created_at as "createdAt"
       FROM ctv_withdrawals w
       JOIN agents a ON w.agent_id = a.id
       WHERE w.status = 'pending'
       ORDER BY w.created_at ASC`);
        return result.rows;
    }
    // Mark withdrawal as completed (admin)
    async completeWithdrawal(withdrawalId, txHash) {
        const result = await this.pool.query(`UPDATE ctv_withdrawals
       SET status = 'completed', tx_hash = $1, processed_at = $2
       WHERE id = $3 AND status = 'pending'`, [txHash, Date.now(), withdrawalId]);
        return (result.rowCount ?? 0) > 0;
    }
    // ============================================
    // AGENT POKES (Social Interactions)
    // ============================================
    async pokeAgent(fromAgentId, toAgentId, pokeType, message) {
        if (fromAgentId === toAgentId) {
            return { success: false, error: 'Cannot poke yourself' };
        }
        const id = uuidv4();
        const now = Date.now();
        try {
            await this.pool.query(`INSERT INTO agent_pokes (id, from_agent_id, to_agent_id, poke_type, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`, [id, fromAgentId, toAgentId, pokeType, message || null, now]);
            return {
                success: true,
                poke: {
                    id,
                    fromAgentId,
                    toAgentId,
                    pokeType,
                    message,
                    createdAt: now,
                },
            };
        }
        catch (err) {
            console.error('Failed to create poke:', err);
            return { success: false, error: 'Failed to send poke' };
        }
    }
    async getAgentPokes(agentId, direction = 'received', limit = 50) {
        let query;
        let params;
        if (direction === 'received') {
            query = `SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
                      poke_type as "pokeType", message, created_at as "createdAt"
               FROM agent_pokes WHERE to_agent_id = $1
               ORDER BY created_at DESC LIMIT $2`;
            params = [agentId, limit];
        }
        else if (direction === 'sent') {
            query = `SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
                      poke_type as "pokeType", message, created_at as "createdAt"
               FROM agent_pokes WHERE from_agent_id = $1
               ORDER BY created_at DESC LIMIT $2`;
            params = [agentId, limit];
        }
        else {
            query = `SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
                      poke_type as "pokeType", message, created_at as "createdAt"
               FROM agent_pokes WHERE from_agent_id = $1 OR to_agent_id = $1
               ORDER BY created_at DESC LIMIT $2`;
            params = [agentId, limit];
        }
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    async getRecentPokesCount(fromAgentId, toAgentId, windowMs = 60000) {
        const since = Date.now() - windowMs;
        const result = await this.pool.query(`SELECT COUNT(*) as count FROM agent_pokes
       WHERE from_agent_id = $1 AND to_agent_id = $2 AND created_at > $3`, [fromAgentId, toAgentId, since]);
        return parseInt(result.rows[0].count, 10);
    }
    // ============================================
    // CLEANUP JOBS
    // ============================================
    /**
     * Delete old ended streams and their associated chat messages.
     * @param maxAgeDays - Delete streams ended more than this many days ago (default: 30)
     */
    async cleanupOldStreams(maxAgeDays = 30) {
        const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        // First, get room IDs of old agent streams to delete their messages
        const oldAgentStreams = await this.pool.query(`SELECT room_id FROM agent_streams WHERE ended_at IS NOT NULL AND ended_at < $1`, [cutoffTime]);
        const oldRoomIds = oldAgentStreams.rows.map((r) => r.room_id);
        // Delete chat messages for old streams
        let messagesDeleted = 0;
        if (oldRoomIds.length > 0) {
            const msgResult = await this.pool.query(`DELETE FROM chat_messages WHERE room_id = ANY($1)`, [oldRoomIds]);
            messagesDeleted = msgResult.rowCount || 0;
        }
        // Delete old agent streams
        const agentStreamResult = await this.pool.query(`DELETE FROM agent_streams WHERE ended_at IS NOT NULL AND ended_at < $1`, [cutoffTime]);
        const agentStreamsDeleted = agentStreamResult.rowCount || 0;
        // Delete old regular streams
        const streamResult = await this.pool.query(`DELETE FROM streams WHERE ended_at IS NOT NULL AND ended_at < $1`, [cutoffTime]);
        const streamsDeleted = streamResult.rowCount || 0;
        if (streamsDeleted > 0 || agentStreamsDeleted > 0 || messagesDeleted > 0) {
            console.log(`[DB Cleanup] Deleted ${streamsDeleted} streams, ${agentStreamsDeleted} agent streams, ${messagesDeleted} messages (older than ${maxAgeDays} days)`);
        }
        return { streams: streamsDeleted, agentStreams: agentStreamsDeleted, messages: messagesDeleted };
    }
    /**
     * Delete orphaned chat messages (messages with no associated stream).
     */
    async cleanupOrphanedMessages() {
        const result = await this.pool.query(`DELETE FROM chat_messages
       WHERE room_id NOT IN (SELECT room_id FROM agent_streams)
       AND room_id NOT IN (SELECT id FROM streams)`);
        const count = result.rowCount || 0;
        if (count > 0) {
            console.log(`[DB Cleanup] Deleted ${count} orphaned chat messages`);
        }
        return count;
    }
    // Analytics - get daily streaming stats for the last N days
    async getDailyStreamingStats(days = 14) {
        const result = await this.pool.query(`SELECT
         DATE(to_timestamp(started_at / 1000)) as date,
         COUNT(*) as "streamCount",
         COUNT(DISTINCT agent_id) as "uniqueAgents",
         COALESCE(SUM(peak_viewers), 0) as "totalViewers"
       FROM agent_streams
       WHERE started_at > $1
       GROUP BY DATE(to_timestamp(started_at / 1000))
       ORDER BY date ASC`, [Date.now() - (days * 24 * 60 * 60 * 1000)]);
        // Fill in missing days with zeros
        const statsMap = new Map();
        result.rows.forEach(row => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            statsMap.set(dateStr, {
                streamCount: parseInt(row.streamCount, 10),
                uniqueAgents: parseInt(row.uniqueAgents, 10),
                totalViewers: parseInt(row.totalViewers, 10)
            });
        });
        // Generate all dates in range
        const stats = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            stats.push({
                date: dateStr,
                ...(statsMap.get(dateStr) || { streamCount: 0, uniqueAgents: 0, totalViewers: 0 })
            });
        }
        return stats;
    }
    /**
     * Run all cleanup jobs. Call this periodically (e.g., once per hour or daily).
     */
    async runCleanupJobs(maxAgeDays = 30) {
        console.log('[DB Cleanup] Starting cleanup jobs...');
        // Clean expired bans
        const bansDeleted = await this.cleanExpiredBans();
        if (bansDeleted > 0) {
            console.log(`[DB Cleanup] Deleted ${bansDeleted} expired bans`);
        }
        // Clean old streams and messages
        await this.cleanupOldStreams(maxAgeDays);
        // Clean orphaned messages
        await this.cleanupOrphanedMessages();
        console.log('[DB Cleanup] Cleanup jobs completed');
    }
    // Waitlist operations
    async addToWaitlist(xHandle) {
        const id = uuidv4();
        const createdAt = Date.now();
        await this.pool.query(`INSERT INTO waitlist (id, x_handle, created_at) VALUES ($1, $2, $3)`, [id, xHandle, createdAt]);
        return { id, xHandle, createdAt };
    }
    async isOnWaitlist(xHandle) {
        const result = await this.pool.query(`SELECT 1 FROM waitlist WHERE x_handle = $1`, [xHandle]);
        return result.rows.length > 0;
    }
    // ============================================
    // News Voting & Comments
    // ============================================
    hashUrl(url) {
        return crypto.createHash('sha256').update(url).digest('hex');
    }
    async voteOnNews(agentId, articleUrl, articleTitle, vote) {
        const urlHash = this.hashUrl(articleUrl);
        const id = uuidv4();
        const now = Date.now();
        // Upsert vote (update if exists, insert if not)
        await this.pool.query(`INSERT INTO news_votes (id, article_url_hash, article_url, article_title, agent_id, vote, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (article_url_hash, agent_id) DO UPDATE SET vote = $6`, [id, urlHash, articleUrl, articleTitle, agentId, vote, now]);
        // Get total score
        const scoreResult = await this.pool.query(`SELECT COALESCE(SUM(vote), 0) as score FROM news_votes WHERE article_url_hash = $1`, [urlHash]);
        const score = parseInt(scoreResult.rows[0]?.score || '0', 10);
        return { success: true, score };
    }
    async getNewsVote(agentId, articleUrl) {
        const urlHash = this.hashUrl(articleUrl);
        const result = await this.pool.query(`SELECT vote FROM news_votes WHERE article_url_hash = $1 AND agent_id = $2`, [urlHash, agentId]);
        return result.rows[0]?.vote || null;
    }
    async getNewsScore(articleUrl) {
        const urlHash = this.hashUrl(articleUrl);
        const result = await this.pool.query(`SELECT COALESCE(SUM(vote), 0) as score FROM news_votes WHERE article_url_hash = $1`, [urlHash]);
        return parseInt(result.rows[0]?.score || '0', 10);
    }
    async commentOnNews(agentId, agentName, articleUrl, articleTitle, content) {
        const id = uuidv4();
        const urlHash = this.hashUrl(articleUrl);
        const now = Date.now();
        await this.pool.query(`INSERT INTO news_comments (id, article_url_hash, article_url, article_title, agent_id, agent_name, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, urlHash, articleUrl, articleTitle, agentId, agentName, content, now]);
        return { id, createdAt: now };
    }
    async getNewsComments(articleUrl, limit = 50) {
        const urlHash = this.hashUrl(articleUrl);
        const result = await this.pool.query(`SELECT id, agent_id, agent_name, content, created_at
       FROM news_comments
       WHERE article_url_hash = $1
       ORDER BY created_at DESC
       LIMIT $2`, [urlHash, limit]);
        return result.rows.map(row => ({
            id: row.id,
            agentId: row.agent_id,
            agentName: row.agent_name,
            content: row.content,
            createdAt: parseInt(row.created_at, 10),
        }));
    }
    async getHotNews(limit = 20) {
        // Get articles with most activity (votes + comments) in last 24 hours
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const result = await this.pool.query(`SELECT
         v.article_url,
         v.article_title,
         COALESCE(SUM(v.vote), 0) as score,
         COUNT(DISTINCT c.id) as comment_count
       FROM news_votes v
       LEFT JOIN news_comments c ON v.article_url_hash = c.article_url_hash
       WHERE v.created_at > $1
       GROUP BY v.article_url, v.article_title
       ORDER BY (COALESCE(SUM(v.vote), 0) + COUNT(DISTINCT c.id)) DESC
       LIMIT $2`, [oneDayAgo, limit]);
        return result.rows.map(row => ({
            articleUrl: row.article_url,
            articleTitle: row.article_title,
            score: parseInt(row.score, 10),
            commentCount: parseInt(row.comment_count, 10),
        }));
    }
    // ============================================
    // CHAT MESSAGE REACTIONS
    // ============================================
    async addChatReaction(messageId, roomId, userId, reaction) {
        const id = uuidv4();
        const now = Date.now();
        // Upsert reaction (update if exists, insert if not)
        await this.pool.query(`INSERT INTO chat_reactions (id, message_id, room_id, user_id, reaction, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (message_id, user_id) DO UPDATE SET reaction = $5`, [id, messageId, roomId, userId, reaction, now]);
        // Get updated counts
        const counts = await this.getChatReactionCounts(messageId);
        return { success: true, ...counts };
    }
    async removeChatReaction(messageId, userId) {
        await this.pool.query(`DELETE FROM chat_reactions WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
        // Get updated counts
        const counts = await this.getChatReactionCounts(messageId);
        return { success: true, ...counts };
    }
    async getChatReactionCounts(messageId) {
        const result = await this.pool.query(`SELECT
         COUNT(*) FILTER (WHERE reaction = 'thumbs_up') as thumbs_up,
         COUNT(*) FILTER (WHERE reaction = 'thumbs_down') as thumbs_down
       FROM chat_reactions
       WHERE message_id = $1`, [messageId]);
        return {
            thumbsUp: parseInt(result.rows[0]?.thumbs_up || '0', 10),
            thumbsDown: parseInt(result.rows[0]?.thumbs_down || '0', 10),
        };
    }
    async getUserReaction(messageId, userId) {
        const result = await this.pool.query(`SELECT reaction FROM chat_reactions WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
        return result.rows[0]?.reaction || null;
    }
    async getChatReactionsForMessages(messageIds) {
        if (messageIds.length === 0) {
            return new Map();
        }
        const result = await this.pool.query(`SELECT
         message_id,
         COUNT(*) FILTER (WHERE reaction = 'thumbs_up') as thumbs_up,
         COUNT(*) FILTER (WHERE reaction = 'thumbs_down') as thumbs_down
       FROM chat_reactions
       WHERE message_id = ANY($1)
       GROUP BY message_id`, [messageIds]);
        const map = new Map();
        for (const row of result.rows) {
            map.set(row.message_id, {
                thumbsUp: parseInt(row.thumbs_up || '0', 10),
                thumbsDown: parseInt(row.thumbs_down || '0', 10),
            });
        }
        return map;
    }
    // Cleanup
    async close() {
        await this.pool.end();
    }
}
//# sourceMappingURL=database.js.map