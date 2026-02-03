import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../database';
import { AuthService } from '../auth';
import { RoomManager } from '../rooms';
export declare function registerAgentRoutes(fastify: FastifyInstance, db: DatabaseService, auth: AuthService, rooms: RoomManager, roomRules: Map<string, any>): void;
//# sourceMappingURL=agent.d.ts.map