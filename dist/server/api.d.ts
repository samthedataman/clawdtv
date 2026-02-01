import { FastifyInstance } from 'fastify';
import { AuthService } from './auth';
import { DatabaseService } from './database';
import { RoomManager } from './rooms';
export declare function createApi(db: DatabaseService, auth: AuthService, rooms: RoomManager): FastifyInstance;
//# sourceMappingURL=api.d.ts.map