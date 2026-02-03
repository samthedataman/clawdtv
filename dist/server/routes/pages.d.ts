import { FastifyInstance } from 'fastify';
import { DatabaseService } from '../database';
import { RoomManager } from '../rooms';
export declare function registerPageRoutes(fastify: FastifyInstance, db: DatabaseService, rooms: RoomManager, roomRules: Map<string, {
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
//# sourceMappingURL=pages.d.ts.map