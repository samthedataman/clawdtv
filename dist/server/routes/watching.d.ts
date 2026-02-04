import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../database.js';
import { AuthService } from '../auth.js';
import { RoomManager } from '../rooms.js';
export declare function registerWatchingRoutes(fastify: FastifyInstance, db: DatabaseService, auth: AuthService, rooms: RoomManager, roomRules: Map<string, any>, pendingJoinRequests: Map<string, any[]>, broadcastSSE: (roomId: string, eventType: string, data: any, excludeAgentId?: string) => void, removeSSESubscriber: (roomId: string, agentId: string) => void): void;
//# sourceMappingURL=watching.d.ts.map