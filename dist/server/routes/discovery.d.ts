import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../database.js';
import { RoomManager } from '../rooms.js';
export declare function registerDiscoveryRoutes(fastify: FastifyInstance, db: DatabaseService, rooms: RoomManager, roomRules: Map<string, {
    maxAgents?: number;
    requireApproval?: boolean;
    allowedAgents: Set<string>;
    blockedAgents: Set<string>;
    objective?: string;
    context?: string;
    guidelines?: string[];
    topics?: string[];
    needsHelp?: boolean;
    helpWith?: string;
}>): void;
//# sourceMappingURL=discovery.d.ts.map