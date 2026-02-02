"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const pg_1 = require("pg");
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class DatabaseService {
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
        this.pool = new pg_1.Pool({
            connectionString: dbUrl,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
    }
    async init() {
        // Run schema
        const schemaPath = path.join(__dirname, '../../db/schema-pg.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        await this.pool.query(schema);
        console.log('PostgreSQL database initialized');
    }
    // User operations
    async createUser(username, passwordHash, displayName) {
        const id = (0, uuid_1.v4)();
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
        const id = (0, uuid_1.v4)();
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
    async saveMessage(roomId, userId, username, content, role) {
        const id = (0, uuid_1.v4)();
        const timestamp = Date.now();
        await this.pool.query(`INSERT INTO chat_messages (id, room_id, user_id, username, content, role, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, roomId, userId, username, content, role, timestamp]);
        return { id, roomId, userId, username, content, role, timestamp };
    }
    async getRecentMessages(roomId, limit = 50) {
        const result = await this.pool.query(`SELECT id, room_id as "roomId", user_id as "userId", username, content, role, timestamp
       FROM chat_messages WHERE room_id = $1 ORDER BY timestamp DESC LIMIT $2`, [roomId, limit]);
        return result.rows.reverse();
    }
    async clearRoomMessages(roomId) {
        const result = await this.pool.query(`DELETE FROM chat_messages WHERE room_id = $1`, [roomId]);
        return result.rowCount || 0;
    }
    // Moderation operations
    async addBan(roomId, userId, type, createdBy, duration) {
        const id = (0, uuid_1.v4)();
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
        const id = (0, uuid_1.v4)();
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
              last_seen_at as "lastSeenAt", created_at as "createdAt"
       FROM agents WHERE api_key = $1`, [apiKey]);
        return result.rows[0] || null;
    }
    async getAgentById(id) {
        const result = await this.pool.query(`SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt"
       FROM agents WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }
    async getAllAgents() {
        const result = await this.pool.query(`SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt"
       FROM agents ORDER BY last_seen_at DESC`);
        return result.rows;
    }
    async getRecentAgents(limit = 20) {
        const result = await this.pool.query(`SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt"
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
    // Agent stream operations
    async createAgentStream(agentId, roomId, title, cols = 80, rows = 24) {
        const id = (0, uuid_1.v4)();
        const startedAt = Date.now();
        await this.pool.query(`INSERT INTO agent_streams (id, agent_id, room_id, title, cols, rows, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, agentId, roomId, title, cols, rows, startedAt]);
        return { id, agentId, roomId, title, cols, rows, startedAt };
    }
    async getActiveAgentStream(agentId) {
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE agent_id = $1 AND ended_at IS NULL`, [agentId]);
        return result.rows[0] || null;
    }
    async getActiveAgentStreams() {
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE ended_at IS NULL`);
        return result.rows;
    }
    async endAgentStream(streamId) {
        const result = await this.pool.query(`UPDATE agent_streams SET ended_at = $1 WHERE id = $2`, [Date.now(), streamId]);
        return (result.rowCount || 0) > 0;
    }
    async getAgentStreamByRoomId(roomId) {
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE room_id = $1`, [roomId]);
        return result.rows[0] || null;
    }
    // History/Archive operations
    async getEndedAgentStreams(limit = 20, offset = 0) {
        const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM agent_streams WHERE ended_at IS NOT NULL`);
        const total = parseInt(countResult.rows[0].count, 10);
        const result = await this.pool.query(`SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
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
              started_at as "startedAt", ended_at as "endedAt"
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
        };
    }
    // Cleanup
    async close() {
        await this.pool.end();
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=database.js.map