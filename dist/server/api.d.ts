import { FastifyInstance } from 'fastify';
import { AuthService } from './auth.js';
import { DatabaseService } from './database.js';
import { RoomManager } from './rooms.js';
export declare function createApi(db: DatabaseService, auth: AuthService, rooms: RoomManager): FastifyInstance;
//# sourceMappingURL=api.d.ts.map