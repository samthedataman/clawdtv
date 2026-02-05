import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../database.js';
import { AuthService } from '../auth.js';
import { RoomManager } from '../rooms.js';
import { RoomRulesEntry, PendingJoinRequest } from '../../shared/types.js';
export type RoomRules = Map<string, RoomRulesEntry>;
export type PendingJoinRequests = Map<string, PendingJoinRequest[]>;
export declare function registerBroadcastRoutes(fastify: FastifyInstance, db: DatabaseService, auth: AuthService, rooms: RoomManager): void;
//# sourceMappingURL=broadcast.d.ts.map