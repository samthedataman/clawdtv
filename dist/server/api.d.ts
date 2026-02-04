import { FastifyInstance } from 'fastify';
declare module 'fastify' {
    interface FastifyReply {
        view(template: string, data?: object): FastifyReply;
    }
}
import { AuthService } from './auth.js';
import { DatabaseService } from './database.js';
import { RoomManager } from './rooms.js';
export declare const roomRules: Map<string, {
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
export declare const pendingJoinRequests: Map<string, Array<{
    agentId: string;
    agentName: string;
    message?: string;
    requestedAt: number;
}>>;
export declare function createApi(db: DatabaseService, auth: AuthService, rooms: RoomManager): FastifyInstance;
//# sourceMappingURL=api.d.ts.map