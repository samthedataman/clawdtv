import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  User,
  UserPublic,
  Stream,
  ChatMessageDB,
  BanRecord,
  UserRole,
  Agent,
  AgentPublic,
  AgentStream,
} from '../shared/types';
import * as crypto from 'crypto';

export class DatabaseService {
  private pool: Pool;

  constructor(connectionString?: string) {
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

  async init(): Promise<void> {
    // Run schema
    const schemaPath = path.join(__dirname, '../../db/schema-pg.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await this.pool.query(schema);
    console.log('PostgreSQL database initialized');
  }

  // User operations
  async createUser(username: string, passwordHash: string, displayName?: string): Promise<User> {
    const id = uuidv4();
    const createdAt = Date.now();

    await this.pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, username, passwordHash, displayName || null, createdAt]
    );

    return { id, username, passwordHash, displayName, createdAt };
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT id, username, password_hash as "passwordHash", display_name as "displayName", created_at as "createdAt" FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT id, username, password_hash as "passwordHash", display_name as "displayName", created_at as "createdAt" FROM users WHERE username = $1`,
      [username]
    );
    return result.rows[0] || null;
  }

  async updateUser(id: string, updates: { displayName?: string }): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE users SET display_name = COALESCE($1, display_name) WHERE id = $2`,
      [updates.displayName || null, id]
    );
    return (result.rowCount || 0) > 0;
  }

  toUserPublic(user: User): UserPublic {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  // Stream operations
  async createStream(
    ownerId: string,
    title: string,
    isPrivate: boolean,
    password?: string,
    maxViewers?: number
  ): Promise<Stream> {
    const id = uuidv4();
    const startedAt = Date.now();

    await this.pool.query(
      `INSERT INTO streams (id, owner_id, title, is_private, password, max_viewers, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, ownerId, title, isPrivate, password || null, maxViewers || null, startedAt]
    );

    return { id, ownerId, title, isPrivate, password, maxViewers, startedAt };
  }

  async getStreamById(id: string): Promise<Stream | null> {
    const result = await this.pool.query(
      `SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getActiveStreams(): Promise<Stream[]> {
    const result = await this.pool.query(
      `SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE ended_at IS NULL ORDER BY started_at DESC`
    );
    return result.rows;
  }

  async getPublicActiveStreams(): Promise<Stream[]> {
    const result = await this.pool.query(
      `SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE ended_at IS NULL AND is_private = false ORDER BY started_at DESC`
    );
    return result.rows;
  }

  async endStream(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE streams SET ended_at = $1 WHERE id = $2 AND ended_at IS NULL`,
      [Date.now(), id]
    );
    return (result.rowCount || 0) > 0;
  }

  // Chat message operations
  async saveMessage(
    roomId: string,
    userId: string,
    username: string,
    content: string,
    role: UserRole
  ): Promise<ChatMessageDB> {
    const id = uuidv4();
    const timestamp = Date.now();

    await this.pool.query(
      `INSERT INTO chat_messages (id, room_id, user_id, username, content, role, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, roomId, userId, username, content, role, timestamp]
    );

    return { id, roomId, userId, username, content, role, timestamp };
  }

  async getRecentMessages(roomId: string, limit: number = 50): Promise<ChatMessageDB[]> {
    const result = await this.pool.query(
      `SELECT id, room_id as "roomId", user_id as "userId", username, content, role, timestamp
       FROM chat_messages WHERE room_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [roomId, limit]
    );
    return result.rows.reverse();
  }

  async clearRoomMessages(roomId: string): Promise<number> {
    const result = await this.pool.query(`DELETE FROM chat_messages WHERE room_id = $1`, [roomId]);
    return result.rowCount || 0;
  }

  // Moderation operations
  async addBan(
    roomId: string,
    userId: string,
    type: 'ban' | 'mute',
    createdBy: string,
    duration?: number
  ): Promise<BanRecord> {
    const id = uuidv4();
    const createdAt = Date.now();
    const expiresAt = duration ? createdAt + duration * 1000 : undefined;

    await this.pool.query(
      `INSERT INTO moderation (id, room_id, user_id, type, expires_at, created_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, roomId, userId, type, expiresAt || null, createdAt, createdBy]
    );

    return { id, roomId, userId, type, expiresAt, createdAt, createdBy };
  }

  async removeBan(roomId: string, userId: string, type: 'ban' | 'mute'): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM moderation WHERE room_id = $1 AND user_id = $2 AND type = $3`,
      [roomId, userId, type]
    );
    return (result.rowCount || 0) > 0;
  }

  async isUserBanned(roomId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM moderation WHERE room_id = $1 AND user_id = $2 AND type = 'ban' AND (expires_at IS NULL OR expires_at > $3)`,
      [roomId, userId, Date.now()]
    );
    return result.rows.length > 0;
  }

  async isUserMuted(roomId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM moderation WHERE room_id = $1 AND user_id = $2 AND type = 'mute' AND (expires_at IS NULL OR expires_at > $3)`,
      [roomId, userId, Date.now()]
    );
    return result.rows.length > 0;
  }

  async getActiveBans(roomId: string): Promise<BanRecord[]> {
    const result = await this.pool.query(
      `SELECT id, room_id as "roomId", user_id as "userId", type, expires_at as "expiresAt",
              created_at as "createdAt", created_by as "createdBy"
       FROM moderation WHERE room_id = $1 AND (expires_at IS NULL OR expires_at > $2)`,
      [roomId, Date.now()]
    );
    return result.rows;
  }

  async cleanExpiredBans(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM moderation WHERE expires_at IS NOT NULL AND expires_at < $1`,
      [Date.now()]
    );
    return result.rowCount || 0;
  }

  // Room moderator operations
  async addMod(roomId: string, userId: string, grantedBy: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO room_mods (room_id, user_id, granted_at, granted_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (room_id, user_id) DO UPDATE SET granted_at = $3, granted_by = $4`,
      [roomId, userId, Date.now(), grantedBy]
    );
  }

  async removeMod(roomId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM room_mods WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  async isMod(roomId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM room_mods WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    return result.rows.length > 0;
  }

  async getRoomMods(roomId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT user_id FROM room_mods WHERE room_id = $1`,
      [roomId]
    );
    return result.rows.map(row => row.user_id);
  }

  // Agent operations
  async createAgent(name: string): Promise<Agent> {
    const id = uuidv4();
    const apiKey = 'ctv_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    await this.pool.query(
      `INSERT INTO agents (id, name, api_key, verified, stream_count, total_viewers, last_seen_at, created_at) VALUES ($1, $2, $3, false, 0, 0, $4, $5)`,
      [id, name, apiKey, now, now]
    );

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

  async getAgentByApiKey(apiKey: string): Promise<Agent | null> {
    const result = await this.pool.query(
      `SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt"
       FROM agents WHERE api_key = $1`,
      [apiKey]
    );
    return result.rows[0] || null;
  }

  async getAgentById(id: string): Promise<Agent | null> {
    const result = await this.pool.query(
      `SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt"
       FROM agents WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getAllAgents(): Promise<Agent[]> {
    const result = await this.pool.query(
      `SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt"
       FROM agents ORDER BY last_seen_at DESC`
    );
    return result.rows;
  }

  async getRecentAgents(limit: number = 20): Promise<Agent[]> {
    const result = await this.pool.query(
      `SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt"
       FROM agents ORDER BY last_seen_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async updateAgentLastSeen(id: string): Promise<void> {
    await this.pool.query(`UPDATE agents SET last_seen_at = $1 WHERE id = $2`, [Date.now(), id]);
  }

  async claimAgent(agentId: string, humanUsername: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE agents SET human_username = $1, verified = true WHERE id = $2`,
      [humanUsername, agentId]
    );
    return (result.rowCount || 0) > 0;
  }

  async incrementAgentStreamCount(agentId: string): Promise<void> {
    await this.pool.query(`UPDATE agents SET stream_count = stream_count + 1 WHERE id = $1`, [agentId]);
  }

  async incrementAgentViewers(agentId: string, count: number): Promise<void> {
    await this.pool.query(`UPDATE agents SET total_viewers = total_viewers + $1 WHERE id = $2`, [count, agentId]);
  }

  // Agent stream operations
  async createAgentStream(agentId: string, roomId: string, title: string, cols: number = 80, rows: number = 24): Promise<AgentStream> {
    const id = uuidv4();
    const startedAt = Date.now();

    await this.pool.query(
      `INSERT INTO agent_streams (id, agent_id, room_id, title, cols, rows, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, agentId, roomId, title, cols, rows, startedAt]
    );

    return { id, agentId, roomId, title, cols, rows, startedAt };
  }

  async getActiveAgentStream(agentId: string): Promise<AgentStream | null> {
    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE agent_id = $1 AND ended_at IS NULL`,
      [agentId]
    );
    return result.rows[0] || null;
  }

  async getActiveAgentStreams(): Promise<AgentStream[]> {
    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE ended_at IS NULL`
    );
    return result.rows;
  }

  async endAgentStream(streamId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE agent_streams SET ended_at = $1 WHERE id = $2`,
      [Date.now(), streamId]
    );
    return (result.rowCount || 0) > 0;
  }

  async getAgentStreamByRoomId(roomId: string): Promise<AgentStream | null> {
    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE room_id = $1`,
      [roomId]
    );
    return result.rows[0] || null;
  }

// History/Archive operations
  async getEndedAgentStreams(limit: number = 20, offset: number = 0): Promise<{ streams: AgentStream[]; total: number }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM agent_streams WHERE ended_at IS NOT NULL`
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { streams: result.rows, total };
  }

  async getEndedStreams(limit: number = 20, offset: number = 0): Promise<{ streams: Stream[]; total: number }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM streams WHERE ended_at IS NOT NULL`
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT id, owner_id as "ownerId", title, is_private as "isPrivate", password,
              max_viewers as "maxViewers", started_at as "startedAt", ended_at as "endedAt"
       FROM streams WHERE ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { streams: result.rows, total };
  }

  async getAllMessagesForRoom(roomId: string, limit: number = 500, offset: number = 0): Promise<{ messages: ChatMessageDB[]; total: number }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM chat_messages WHERE room_id = $1`,
      [roomId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT id, room_id as "roomId", user_id as "userId", username, content, role, timestamp
       FROM chat_messages WHERE room_id = $1 ORDER BY timestamp ASC LIMIT $2 OFFSET $3`,
      [roomId, limit, offset]
    );
    return { messages: result.rows, total };
  }

  async getAgentStreamsByAgentId(agentId: string, limit: number = 20, offset: number = 0): Promise<{ streams: AgentStream[]; total: number }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM agent_streams WHERE agent_id = $1 AND ended_at IS NOT NULL`,
      [agentId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt"
       FROM agent_streams WHERE agent_id = $1 AND ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );
    return { streams: result.rows, total };
  }

  toAgentPublic(agent: Agent, isStreaming: boolean = false): AgentPublic {
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
  async close(): Promise<void> {
    await this.pool.end();
  }
}
