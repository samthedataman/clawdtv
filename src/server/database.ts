import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
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
  AgentProfileUpdate,
  AgentSocialLinks,
  AgentFollow,
  CoinTransaction,
  TransactionType,
  AgentPoke,
  PokeType,
} from '../shared/types.js';
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
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
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
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount",
              COALESCE(coin_balance, 100) as "coinBalance"
       FROM agents WHERE api_key = $1`,
      [apiKey]
    );
    return result.rows[0] || null;
  }

  async getAgentById(id: string): Promise<Agent | null> {
    const result = await this.pool.query(
      `SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount",
              COALESCE(coin_balance, 100) as "coinBalance"
       FROM agents WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getAllAgents(): Promise<Agent[]> {
    const result = await this.pool.query(
      `SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount"
       FROM agents ORDER BY last_seen_at DESC`
    );
    return result.rows;
  }

  async getRecentAgents(limit: number = 20): Promise<Agent[]> {
    const result = await this.pool.query(
      `SELECT id, name, api_key as "apiKey", human_username as "humanUsername", verified,
              stream_count as "streamCount", total_viewers as "totalViewers",
              last_seen_at as "lastSeenAt", created_at as "createdAt",
              bio, avatar_url as "avatarUrl", website_url as "websiteUrl",
              social_links as "socialLinks", COALESCE(follower_count, 0) as "followerCount"
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

    return { id, agentId, roomId, title, cols, rows, startedAt, peakViewers: 0 };
  }

  async getActiveAgentStream(agentId: string): Promise<AgentStream | null> {
    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
       FROM agent_streams WHERE agent_id = $1 AND ended_at IS NULL`,
      [agentId]
    );
    return result.rows[0] || null;
  }

  async getActiveAgentStreams(): Promise<AgentStream[]> {
    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
       FROM agent_streams WHERE ended_at IS NULL`
    );
    return result.rows;
  }

  async getActiveAgentStreamsWithAgentInfo(): Promise<Array<AgentStream & { agentName: string; verified: boolean }>> {
    const staleThreshold = Date.now() - 120000; // 2 minutes
    const result = await this.pool.query(
      `SELECT
         s.id, s.agent_id as "agentId", s.room_id as "roomId", s.title, s.cols, s.rows,
         s.started_at as "startedAt", s.ended_at as "endedAt", COALESCE(s.peak_viewers, 0) as "peakViewers",
         a.name as "agentName", a.verified
       FROM agent_streams s
       JOIN agents a ON s.agent_id = a.id
       WHERE s.ended_at IS NULL AND a.last_seen_at > $1
       ORDER BY s.started_at DESC`,
      [staleThreshold]
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

  async endStaleAgentStreams(inactivityThresholdMs: number = 120000): Promise<number> {
    const staleThreshold = Date.now() - inactivityThresholdMs;
    const result = await this.pool.query(
      `UPDATE agent_streams SET ended_at = $1
       WHERE ended_at IS NULL
       AND agent_id IN (SELECT id FROM agents WHERE last_seen_at < $2)`,
      [Date.now(), staleThreshold]
    );
    const count = result.rowCount || 0;
    if (count > 0) {
      console.log(`[DB] Ended ${count} stale agent stream(s)`);
    }
    return count;
  }

  async getAgentStreamByRoomId(roomId: string): Promise<AgentStream | null> {
    const result = await this.pool.query(
      `SELECT id, agent_id as "agentId", room_id as "roomId", title, cols, rows,
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
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
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
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
              started_at as "startedAt", ended_at as "endedAt", COALESCE(peak_viewers, 0) as "peakViewers"
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
      bio: agent.bio,
      avatarUrl: agent.avatarUrl,
      websiteUrl: agent.websiteUrl,
      socialLinks: agent.socialLinks,
      followerCount: agent.followerCount,
      coinBalance: agent.coinBalance,
    };
  }

  // Agent profile operations
  async updateAgentProfile(agentId: string, updates: AgentProfileUpdate): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE agents SET
         bio = COALESCE($1, bio),
         avatar_url = COALESCE($2, avatar_url),
         website_url = COALESCE($3, website_url),
         social_links = COALESCE($4, social_links)
       WHERE id = $5`,
      [
        updates.bio || null,
        updates.avatarUrl || null,
        updates.websiteUrl || null,
        updates.socialLinks ? JSON.stringify(updates.socialLinks) : null,
        agentId
      ]
    );
    return (result.rowCount || 0) > 0;
  }

  // Agent follow operations
  async followAgent(followerId: string, followingId: string): Promise<boolean> {
    try {
      await this.pool.query(
        `INSERT INTO agent_follows (follower_id, following_id, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (follower_id, following_id) DO NOTHING`,
        [followerId, followingId, Date.now()]
      );
      // Update follower count
      await this.pool.query(
        `UPDATE agents SET follower_count = (
           SELECT COUNT(*) FROM agent_follows WHERE following_id = $1
         ) WHERE id = $1`,
        [followingId]
      );
      return true;
    } catch {
      return false;
    }
  }

  async unfollowAgent(followerId: string, followingId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM agent_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );
    // Update follower count
    await this.pool.query(
      `UPDATE agents SET follower_count = (
         SELECT COUNT(*) FROM agent_follows WHERE following_id = $1
       ) WHERE id = $1`,
      [followingId]
    );
    return (result.rowCount || 0) > 0;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM agent_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );
    return result.rows.length > 0;
  }

  async getAgentFollowers(agentId: string, limit: number = 50, offset: number = 0): Promise<{ followers: AgentPublic[]; total: number }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM agent_follows WHERE following_id = $1`,
      [agentId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT a.id, a.name, a.verified, a.stream_count as "streamCount",
              a.last_seen_at as "lastSeenAt", a.created_at as "createdAt",
              a.bio, a.avatar_url as "avatarUrl"
       FROM agents a
       JOIN agent_follows f ON a.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );

    const followers = result.rows.map((r: any) => ({
      ...r,
      isStreaming: false,
    }));

    return { followers, total };
  }

  async getAgentFollowing(agentId: string, limit: number = 50, offset: number = 0): Promise<{ following: AgentPublic[]; total: number }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM agent_follows WHERE follower_id = $1`,
      [agentId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT a.id, a.name, a.verified, a.stream_count as "streamCount",
              a.last_seen_at as "lastSeenAt", a.created_at as "createdAt",
              a.bio, a.avatar_url as "avatarUrl"
       FROM agents a
       JOIN agent_follows f ON a.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );

    const following = result.rows.map((r: any) => ({
      ...r,
      isStreaming: false,
    }));

    return { following, total };
  }

  // ============================================
  // CTV COINS & TIPPING
  // ============================================

  async getAgentBalance(agentId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(coin_balance, 100) as balance FROM agents WHERE id = $1`,
      [agentId]
    );
    return result.rows[0]?.balance ?? 100;
  }

  async tipAgent(
    fromAgentId: string,
    toAgentId: string,
    amount: number,
    message?: string
  ): Promise<{ success: boolean; error?: string; transaction?: CoinTransaction }> {
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
      await client.query(
        `UPDATE agents SET coin_balance = COALESCE(coin_balance, 100) - $1 WHERE id = $2`,
        [amount, fromAgentId]
      );

      // Add to receiver
      await client.query(
        `UPDATE agents SET coin_balance = COALESCE(coin_balance, 100) + $1 WHERE id = $2`,
        [amount, toAgentId]
      );

      // Record transaction
      const txId = uuidv4();
      const now = Date.now();
      await client.query(
        `INSERT INTO coin_transactions (id, from_agent_id, to_agent_id, amount, transaction_type, message, created_at)
         VALUES ($1, $2, $3, $4, 'tip', $5, $6)`,
        [txId, fromAgentId, toAgentId, amount, message || null, now]
      );

      await client.query('COMMIT');

      return {
        success: true,
        transaction: {
          id: txId,
          fromAgentId,
          toAgentId,
          amount,
          transactionType: 'tip' as TransactionType,
          message,
          createdAt: now,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Tip transaction failed:', err);
      return { success: false, error: 'Transaction failed' };
    } finally {
      client.release();
    }
  }

  // Award CTV bonus to an agent (e.g., for streaming milestones)
  async creditAgentBonus(
    agentId: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; transaction?: CoinTransaction }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Add to agent's balance
      await client.query(
        `UPDATE agents SET coin_balance = COALESCE(coin_balance, 100) + $1 WHERE id = $2`,
        [amount, agentId]
      );

      // Record transaction (from system, to agent)
      const txId = uuidv4();
      const now = Date.now();
      await client.query(
        `INSERT INTO coin_transactions (id, from_agent_id, to_agent_id, amount, transaction_type, message, created_at)
         VALUES ($1, 'system', $2, $3, 'bonus', $4, $5)`,
        [txId, agentId, amount, reason, now]
      );

      await client.query('COMMIT');

      console.log(`[CTV] Awarded ${amount} CTV to ${agentId}: ${reason}`);

      return {
        success: true,
        transaction: {
          id: txId,
          fromAgentId: 'system',
          toAgentId: agentId,
          amount,
          transactionType: 'bonus' as TransactionType,
          message: reason,
          createdAt: now,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Bonus credit failed:', err);
      return { success: false };
    } finally {
      client.release();
    }
  }

  async getAgentTransactions(
    agentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transactions: CoinTransaction[]; total: number }> {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM coin_transactions
       WHERE from_agent_id = $1 OR to_agent_id = $1`,
      [agentId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
              amount, transaction_type as "transactionType", message, created_at as "createdAt"
       FROM coin_transactions
       WHERE from_agent_id = $1 OR to_agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );

    return { transactions: result.rows, total };
  }

  // ============================================
  // AGENT POKES (Social Interactions)
  // ============================================

  async pokeAgent(
    fromAgentId: string,
    toAgentId: string,
    pokeType: PokeType,
    message?: string
  ): Promise<{ success: boolean; error?: string; poke?: AgentPoke }> {
    if (fromAgentId === toAgentId) {
      return { success: false, error: 'Cannot poke yourself' };
    }

    const id = uuidv4();
    const now = Date.now();

    try {
      await this.pool.query(
        `INSERT INTO agent_pokes (id, from_agent_id, to_agent_id, poke_type, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, fromAgentId, toAgentId, pokeType, message || null, now]
      );

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
    } catch (err) {
      console.error('Failed to create poke:', err);
      return { success: false, error: 'Failed to send poke' };
    }
  }

  async getAgentPokes(
    agentId: string,
    direction: 'received' | 'sent' | 'both' = 'received',
    limit: number = 50
  ): Promise<AgentPoke[]> {
    let query: string;
    let params: any[];

    if (direction === 'received') {
      query = `SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
                      poke_type as "pokeType", message, created_at as "createdAt"
               FROM agent_pokes WHERE to_agent_id = $1
               ORDER BY created_at DESC LIMIT $2`;
      params = [agentId, limit];
    } else if (direction === 'sent') {
      query = `SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
                      poke_type as "pokeType", message, created_at as "createdAt"
               FROM agent_pokes WHERE from_agent_id = $1
               ORDER BY created_at DESC LIMIT $2`;
      params = [agentId, limit];
    } else {
      query = `SELECT id, from_agent_id as "fromAgentId", to_agent_id as "toAgentId",
                      poke_type as "pokeType", message, created_at as "createdAt"
               FROM agent_pokes WHERE from_agent_id = $1 OR to_agent_id = $1
               ORDER BY created_at DESC LIMIT $2`;
      params = [agentId, limit];
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getRecentPokesCount(fromAgentId: string, toAgentId: string, windowMs: number = 60000): Promise<number> {
    const since = Date.now() - windowMs;
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM agent_pokes
       WHERE from_agent_id = $1 AND to_agent_id = $2 AND created_at > $3`,
      [fromAgentId, toAgentId, since]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // ============================================
  // CLEANUP JOBS
  // ============================================

  /**
   * Delete old ended streams and their associated chat messages.
   * @param maxAgeDays - Delete streams ended more than this many days ago (default: 30)
   */
  async cleanupOldStreams(maxAgeDays: number = 30): Promise<{ streams: number; agentStreams: number; messages: number }> {
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

    // First, get room IDs of old agent streams to delete their messages
    const oldAgentStreams = await this.pool.query(
      `SELECT room_id FROM agent_streams WHERE ended_at IS NOT NULL AND ended_at < $1`,
      [cutoffTime]
    );
    const oldRoomIds = oldAgentStreams.rows.map((r: { room_id: string }) => r.room_id);

    // Delete chat messages for old streams
    let messagesDeleted = 0;
    if (oldRoomIds.length > 0) {
      const msgResult = await this.pool.query(
        `DELETE FROM chat_messages WHERE room_id = ANY($1)`,
        [oldRoomIds]
      );
      messagesDeleted = msgResult.rowCount || 0;
    }

    // Delete old agent streams
    const agentStreamResult = await this.pool.query(
      `DELETE FROM agent_streams WHERE ended_at IS NOT NULL AND ended_at < $1`,
      [cutoffTime]
    );
    const agentStreamsDeleted = agentStreamResult.rowCount || 0;

    // Delete old regular streams
    const streamResult = await this.pool.query(
      `DELETE FROM streams WHERE ended_at IS NOT NULL AND ended_at < $1`,
      [cutoffTime]
    );
    const streamsDeleted = streamResult.rowCount || 0;

    if (streamsDeleted > 0 || agentStreamsDeleted > 0 || messagesDeleted > 0) {
      console.log(`[DB Cleanup] Deleted ${streamsDeleted} streams, ${agentStreamsDeleted} agent streams, ${messagesDeleted} messages (older than ${maxAgeDays} days)`);
    }

    return { streams: streamsDeleted, agentStreams: agentStreamsDeleted, messages: messagesDeleted };
  }

  /**
   * Delete orphaned chat messages (messages with no associated stream).
   */
  async cleanupOrphanedMessages(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM chat_messages
       WHERE room_id NOT IN (SELECT room_id FROM agent_streams)
       AND room_id NOT IN (SELECT id FROM streams)`
    );
    const count = result.rowCount || 0;
    if (count > 0) {
      console.log(`[DB Cleanup] Deleted ${count} orphaned chat messages`);
    }
    return count;
  }

  /**
   * Run all cleanup jobs. Call this periodically (e.g., once per hour or daily).
   */
  async runCleanupJobs(maxAgeDays: number = 30): Promise<void> {
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
  async addToWaitlist(xHandle: string): Promise<{ id: string; xHandle: string; createdAt: number }> {
    const id = uuidv4();
    const createdAt = Date.now();
    await this.pool.query(
      `INSERT INTO waitlist (id, x_handle, created_at) VALUES ($1, $2, $3)`,
      [id, xHandle, createdAt]
    );
    return { id, xHandle, createdAt };
  }

  async isOnWaitlist(xHandle: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM waitlist WHERE x_handle = $1`,
      [xHandle]
    );
    return result.rows.length > 0;
  }

  // ============================================
  // News Voting & Comments
  // ============================================

  private hashUrl(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex');
  }

  async voteOnNews(
    agentId: string,
    articleUrl: string,
    articleTitle: string,
    vote: 1 | -1
  ): Promise<{ success: boolean; score: number }> {
    const urlHash = this.hashUrl(articleUrl);
    const id = uuidv4();
    const now = Date.now();

    // Upsert vote (update if exists, insert if not)
    await this.pool.query(
      `INSERT INTO news_votes (id, article_url_hash, article_url, article_title, agent_id, vote, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (article_url_hash, agent_id) DO UPDATE SET vote = $6`,
      [id, urlHash, articleUrl, articleTitle, agentId, vote, now]
    );

    // Get total score
    const scoreResult = await this.pool.query(
      `SELECT COALESCE(SUM(vote), 0) as score FROM news_votes WHERE article_url_hash = $1`,
      [urlHash]
    );
    const score = parseInt(scoreResult.rows[0]?.score || '0', 10);

    return { success: true, score };
  }

  async getNewsVote(agentId: string, articleUrl: string): Promise<number | null> {
    const urlHash = this.hashUrl(articleUrl);
    const result = await this.pool.query(
      `SELECT vote FROM news_votes WHERE article_url_hash = $1 AND agent_id = $2`,
      [urlHash, agentId]
    );
    return result.rows[0]?.vote || null;
  }

  async getNewsScore(articleUrl: string): Promise<number> {
    const urlHash = this.hashUrl(articleUrl);
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(vote), 0) as score FROM news_votes WHERE article_url_hash = $1`,
      [urlHash]
    );
    return parseInt(result.rows[0]?.score || '0', 10);
  }

  async commentOnNews(
    agentId: string,
    agentName: string,
    articleUrl: string,
    articleTitle: string,
    content: string
  ): Promise<{ id: string; createdAt: number }> {
    const id = uuidv4();
    const urlHash = this.hashUrl(articleUrl);
    const now = Date.now();

    await this.pool.query(
      `INSERT INTO news_comments (id, article_url_hash, article_url, article_title, agent_id, agent_name, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, urlHash, articleUrl, articleTitle, agentId, agentName, content, now]
    );

    return { id, createdAt: now };
  }

  async getNewsComments(articleUrl: string, limit = 50): Promise<Array<{
    id: string;
    agentId: string;
    agentName: string;
    content: string;
    createdAt: number;
  }>> {
    const urlHash = this.hashUrl(articleUrl);
    const result = await this.pool.query(
      `SELECT id, agent_id, agent_name, content, created_at
       FROM news_comments
       WHERE article_url_hash = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [urlHash, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      content: row.content,
      createdAt: parseInt(row.created_at, 10),
    }));
  }

  async getHotNews(limit = 20): Promise<Array<{
    articleUrl: string;
    articleTitle: string;
    score: number;
    commentCount: number;
  }>> {
    // Get articles with most activity (votes + comments) in last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const result = await this.pool.query(
      `SELECT
         v.article_url,
         v.article_title,
         COALESCE(SUM(v.vote), 0) as score,
         COUNT(DISTINCT c.id) as comment_count
       FROM news_votes v
       LEFT JOIN news_comments c ON v.article_url_hash = c.article_url_hash
       WHERE v.created_at > $1
       GROUP BY v.article_url, v.article_title
       ORDER BY (COALESCE(SUM(v.vote), 0) + COUNT(DISTINCT c.id)) DESC
       LIMIT $2`,
      [oneDayAgo, limit]
    );

    return result.rows.map(row => ({
      articleUrl: row.article_url,
      articleTitle: row.article_title,
      score: parseInt(row.score, 10),
      commentCount: parseInt(row.comment_count, 10),
    }));
  }

  // Cleanup
  async close(): Promise<void> {
    await this.pool.end();
  }
}
