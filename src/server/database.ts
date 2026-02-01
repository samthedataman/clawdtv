import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
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
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initSchema();

    // Auto-save every 30 seconds
    this.saveInterval = setInterval(() => this.save(), 30000);
  }

  private initSchema(): void {
    if (!this.db) throw new Error('Database not initialized');

    const schemaPath = path.join(__dirname, '../../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.run(schema);
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  // User operations
  createUser(username: string, passwordHash: string, displayName?: string): User {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const createdAt = Date.now();

    this.db.run(
      `INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, username, passwordHash, displayName || null, createdAt]
    );

    this.save();

    return {
      id,
      username,
      passwordHash,
      displayName,
      createdAt,
    };
  }

  getUserById(id: string): User | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT id, username, password_hash as passwordHash, display_name as displayName, created_at as createdAt FROM users WHERE id = ?`
    );
    stmt.bind([id]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  getUserByUsername(username: string): User | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT id, username, password_hash as passwordHash, display_name as displayName, created_at as createdAt FROM users WHERE username = ?`
    );
    stmt.bind([username]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  updateUser(id: string, updates: { displayName?: string }): boolean {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `UPDATE users SET display_name = COALESCE(?, display_name) WHERE id = ?`,
      [updates.displayName || null, id]
    );

    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes > 0;
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
  createStream(
    ownerId: string,
    title: string,
    isPrivate: boolean,
    password?: string,
    maxViewers?: number
  ): Stream {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const startedAt = Date.now();

    this.db.run(
      `INSERT INTO streams (id, owner_id, title, is_private, password, max_viewers, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, ownerId, title, isPrivate ? 1 : 0, password || null, maxViewers || null, startedAt]
    );

    this.save();

    return {
      id,
      ownerId,
      title,
      isPrivate,
      password,
      maxViewers,
      startedAt,
    };
  }

  getStreamById(id: string): Stream | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT id, owner_id as ownerId, title, is_private as isPrivate, password,
              max_viewers as maxViewers, started_at as startedAt, ended_at as endedAt
       FROM streams WHERE id = ?`
    );
    stmt.bind([id]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        ...row,
        isPrivate: !!row.isPrivate,
      };
    }
    stmt.free();
    return null;
  }

  getActiveStreams(): Stream[] {
    if (!this.db) throw new Error('Database not initialized');

    const results: Stream[] = [];
    const stmt = this.db.prepare(
      `SELECT id, owner_id as ownerId, title, is_private as isPrivate, password,
              max_viewers as maxViewers, started_at as startedAt, ended_at as endedAt
       FROM streams WHERE ended_at IS NULL ORDER BY started_at DESC`
    );

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push({
        ...row,
        isPrivate: !!row.isPrivate,
      });
    }
    stmt.free();
    return results;
  }

  getPublicActiveStreams(): Stream[] {
    if (!this.db) throw new Error('Database not initialized');

    const results: Stream[] = [];
    const stmt = this.db.prepare(
      `SELECT id, owner_id as ownerId, title, is_private as isPrivate, password,
              max_viewers as maxViewers, started_at as startedAt, ended_at as endedAt
       FROM streams WHERE ended_at IS NULL AND is_private = 0 ORDER BY started_at DESC`
    );

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push({
        ...row,
        isPrivate: !!row.isPrivate,
      });
    }
    stmt.free();
    return results;
  }

  endStream(id: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `UPDATE streams SET ended_at = ? WHERE id = ? AND ended_at IS NULL`,
      [Date.now(), id]
    );

    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes > 0;
  }

  // Chat message operations
  saveMessage(
    roomId: string,
    userId: string,
    username: string,
    content: string,
    role: UserRole
  ): ChatMessageDB {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const timestamp = Date.now();

    this.db.run(
      `INSERT INTO chat_messages (id, room_id, user_id, username, content, role, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, roomId, userId, username, content, role, timestamp]
    );

    this.save();

    return {
      id,
      roomId,
      userId,
      username,
      content,
      role,
      timestamp,
    };
  }

  getRecentMessages(roomId: string, limit: number = 50): ChatMessageDB[] {
    if (!this.db) throw new Error('Database not initialized');

    const results: ChatMessageDB[] = [];
    const stmt = this.db.prepare(
      `SELECT id, room_id as roomId, user_id as userId, username, content, role, timestamp
       FROM chat_messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT ?`
    );
    stmt.bind([roomId, limit]);

    while (stmt.step()) {
      results.push(stmt.getAsObject() as any);
    }
    stmt.free();
    return results.reverse();
  }

  clearRoomMessages(roomId: string): number {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`DELETE FROM chat_messages WHERE room_id = ?`, [roomId]);
    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes;
  }

  // Moderation operations
  addBan(
    roomId: string,
    userId: string,
    type: 'ban' | 'mute',
    createdBy: string,
    duration?: number
  ): BanRecord {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const createdAt = Date.now();
    const expiresAt = duration ? createdAt + duration * 1000 : undefined;

    this.db.run(
      `INSERT INTO moderation (id, room_id, user_id, type, expires_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, roomId, userId, type, expiresAt || null, createdAt, createdBy]
    );

    this.save();

    return {
      id,
      roomId,
      userId,
      type,
      expiresAt,
      createdAt,
      createdBy,
    };
  }

  removeBan(roomId: string, userId: string, type: 'ban' | 'mute'): boolean {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `DELETE FROM moderation WHERE room_id = ? AND user_id = ? AND type = ?`,
      [roomId, userId, type]
    );

    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes > 0;
  }

  isUserBanned(roomId: string, userId: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT 1 FROM moderation WHERE room_id = ? AND user_id = ? AND type = 'ban' AND (expires_at IS NULL OR expires_at > ?)`
    );
    stmt.bind([roomId, userId, Date.now()]);

    const result = stmt.step();
    stmt.free();
    return result;
  }

  isUserMuted(roomId: string, userId: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT 1 FROM moderation WHERE room_id = ? AND user_id = ? AND type = 'mute' AND (expires_at IS NULL OR expires_at > ?)`
    );
    stmt.bind([roomId, userId, Date.now()]);

    const result = stmt.step();
    stmt.free();
    return result;
  }

  getActiveBans(roomId: string): BanRecord[] {
    if (!this.db) throw new Error('Database not initialized');

    const results: BanRecord[] = [];
    const stmt = this.db.prepare(
      `SELECT id, room_id as roomId, user_id as userId, type, expires_at as expiresAt,
              created_at as createdAt, created_by as createdBy
       FROM moderation WHERE room_id = ? AND (expires_at IS NULL OR expires_at > ?)`
    );
    stmt.bind([roomId, Date.now()]);

    while (stmt.step()) {
      results.push(stmt.getAsObject() as any);
    }
    stmt.free();
    return results;
  }

  cleanExpiredBans(): number {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `DELETE FROM moderation WHERE expires_at IS NOT NULL AND expires_at < ?`,
      [Date.now()]
    );

    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes;
  }

  // Room moderator operations
  addMod(roomId: string, userId: string, grantedBy: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT OR REPLACE INTO room_mods (room_id, user_id, granted_at, granted_by) VALUES (?, ?, ?, ?)`,
      [roomId, userId, Date.now(), grantedBy]
    );
    this.save();
  }

  removeMod(roomId: string, userId: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `DELETE FROM room_mods WHERE room_id = ? AND user_id = ?`,
      [roomId, userId]
    );

    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes > 0;
  }

  isMod(roomId: string, userId: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT 1 FROM room_mods WHERE room_id = ? AND user_id = ?`
    );
    stmt.bind([roomId, userId]);

    const result = stmt.step();
    stmt.free();
    return result;
  }

  getRoomMods(roomId: string): string[] {
    if (!this.db) throw new Error('Database not initialized');

    const results: string[] = [];
    const stmt = this.db.prepare(`SELECT user_id FROM room_mods WHERE room_id = ?`);
    stmt.bind([roomId]);

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push(row.user_id);
    }
    stmt.free();
    return results;
  }

  // Agent operations
  createAgent(name: string): Agent {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const apiKey = 'ctv_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    this.db.run(
      `INSERT INTO agents (id, name, api_key, verified, stream_count, total_viewers, last_seen_at, created_at) VALUES (?, ?, ?, 0, 0, 0, ?, ?)`,
      [id, name, apiKey, now, now]
    );

    this.save();

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

  getAgentByApiKey(apiKey: string): Agent | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT id, name, api_key as apiKey, human_username as humanUsername, verified,
              stream_count as streamCount, total_viewers as totalViewers,
              last_seen_at as lastSeenAt, created_at as createdAt
       FROM agents WHERE api_key = ?`
    );
    stmt.bind([apiKey]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return { ...row, verified: !!row.verified };
    }
    stmt.free();
    return null;
  }

  getAgentById(id: string): Agent | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT id, name, api_key as apiKey, human_username as humanUsername, verified,
              stream_count as streamCount, total_viewers as totalViewers,
              last_seen_at as lastSeenAt, created_at as createdAt
       FROM agents WHERE id = ?`
    );
    stmt.bind([id]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return { ...row, verified: !!row.verified };
    }
    stmt.free();
    return null;
  }

  getAllAgents(): Agent[] {
    if (!this.db) throw new Error('Database not initialized');

    const results: Agent[] = [];
    const stmt = this.db.prepare(
      `SELECT id, name, api_key as apiKey, human_username as humanUsername, verified,
              stream_count as streamCount, total_viewers as totalViewers,
              last_seen_at as lastSeenAt, created_at as createdAt
       FROM agents ORDER BY last_seen_at DESC`
    );

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push({ ...row, verified: !!row.verified });
    }
    stmt.free();
    return results;
  }

  getRecentAgents(limit: number = 20): Agent[] {
    if (!this.db) throw new Error('Database not initialized');

    const results: Agent[] = [];
    const stmt = this.db.prepare(
      `SELECT id, name, api_key as apiKey, human_username as humanUsername, verified,
              stream_count as streamCount, total_viewers as totalViewers,
              last_seen_at as lastSeenAt, created_at as createdAt
       FROM agents ORDER BY last_seen_at DESC LIMIT ?`
    );
    stmt.bind([limit]);

    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push({ ...row, verified: !!row.verified });
    }
    stmt.free();
    return results;
  }

  updateAgentLastSeen(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE agents SET last_seen_at = ? WHERE id = ?`, [Date.now(), id]);
    this.save();
  }

  claimAgent(agentId: string, humanUsername: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `UPDATE agents SET human_username = ?, verified = 1 WHERE id = ?`,
      [humanUsername, agentId]
    );

    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes > 0;
  }

  incrementAgentStreamCount(agentId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE agents SET stream_count = stream_count + 1 WHERE id = ?`, [agentId]);
    this.save();
  }

  incrementAgentViewers(agentId: string, count: number): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE agents SET total_viewers = total_viewers + ? WHERE id = ?`, [count, agentId]);
    this.save();
  }

  // Agent stream operations
  createAgentStream(agentId: string, roomId: string, title: string, cols: number = 80, rows: number = 24): AgentStream {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const startedAt = Date.now();

    this.db.run(
      `INSERT INTO agent_streams (id, agent_id, room_id, title, cols, rows, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, agentId, roomId, title, cols, rows, startedAt]
    );

    this.save();

    return { id, agentId, roomId, title, cols, rows, startedAt };
  }

  getActiveAgentStream(agentId: string): AgentStream | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT id, agent_id as agentId, room_id as roomId, title, cols, rows,
              started_at as startedAt, ended_at as endedAt
       FROM agent_streams WHERE agent_id = ? AND ended_at IS NULL`
    );
    stmt.bind([agentId]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  endAgentStream(streamId: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`UPDATE agent_streams SET ended_at = ? WHERE id = ?`, [Date.now(), streamId]);

    const changes = this.db.getRowsModified();
    if (changes > 0) this.save();
    return changes > 0;
  }

  getAgentStreamByRoomId(roomId: string): AgentStream | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      `SELECT id, agent_id as agentId, room_id as roomId, title, cols, rows,
              started_at as startedAt, ended_at as endedAt
       FROM agent_streams WHERE room_id = ?`
    );
    stmt.bind([roomId]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
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
  close(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
