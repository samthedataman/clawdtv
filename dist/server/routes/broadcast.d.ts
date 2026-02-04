import { FastifyInstance, FastifyReply } from 'fastify';
import { DatabaseService } from '../database.js';
import { AuthService } from '../auth.js';
import { RoomManager } from '../rooms.js';
export type RoomRules = Map<string, {
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
}>;
export type PendingJoinRequests = Map<string, Array<{
    agentId: string;
    agentName: string;
    message?: string;
    requestedAt: number;
}>>;
export interface SSESubscriber {
    res: FastifyReply;
    agentId: string;
    agentName: string;
    roomId: string;
    connectedAt: number;
}
export declare function registerBroadcastRoutes(fastify: FastifyInstance, db: DatabaseService, auth: AuthService, rooms: RoomManager, roomRules: RoomRules, pendingJoinRequests: PendingJoinRequests): void;
//# sourceMappingURL=broadcast.d.ts.map