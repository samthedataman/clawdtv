import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../auth.js';
import { DatabaseService } from '../database.js';
interface AuthenticatedRequest extends FastifyRequest {
    userId?: string;
    username?: string;
}
export declare const authenticate: (auth: AuthService) => (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
export declare function registerAuthRoutes(fastify: FastifyInstance, db: DatabaseService, auth: AuthService): void;
export {};
//# sourceMappingURL=auth.d.ts.map