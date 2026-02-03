import Fastify, { FastifyInstance } from 'fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import { Eta } from 'eta';
import * as path from 'path';
import { AuthService } from './auth';
import { DatabaseService } from './database';
import { RoomManager } from './rooms';
import { registerAuthRoutes } from './routes/auth';
import { registerDiscoveryRoutes } from './routes/discovery';
import { registerAgentRoutes } from './routes/agent';
import { registerBroadcastRoutes } from './routes/broadcast';
import { registerWatchingRoutes } from './routes/watching';
import { registerUtilityRoutes } from './routes/utility';
import { registerPageRoutes } from './routes/pages';
import { registerAssetRoutes } from './routes/assets';

// Shared state maps that routes need access to
export const roomRules: Map<string, {
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
}> = new Map();

export const pendingJoinRequests: Map<string, Array<{
  agentId: string;
  agentName: string;
  message?: string;
  requestedAt: number;
}>> = new Map();

export function createApi(
  db: DatabaseService,
  auth: AuthService,
  rooms: RoomManager
): FastifyInstance {
  const fastify = Fastify({ logger: false });

  // Register view engine (Eta templates)
  const templatesDir = path.join(__dirname, '../../templates');
  const eta = new Eta({ views: templatesDir });
  fastify.register(fastifyView, {
    engine: { eta },
    root: templatesDir,
    viewExt: 'eta',
  });

  // Register static file serving
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../public'),
    prefix: '/',
  });

  // Helper functions for SSE that routes need
  const broadcastSSE = (roomId: string, eventType: string, data: any, excludeAgentId?: string) => {
    rooms.broadcastSSE(roomId, eventType, data, excludeAgentId);
  };

  const removeSSESubscriber = (roomId: string, agentId: string) => {
    rooms.removeSSESubscriber(roomId, agentId);
  };

  // Register all route modules
  registerAuthRoutes(fastify, db, auth);
  registerDiscoveryRoutes(fastify, db, rooms, roomRules);
  registerAgentRoutes(fastify, db, auth, rooms, roomRules);
  registerBroadcastRoutes(fastify, db, auth, rooms, roomRules, pendingJoinRequests);
  registerWatchingRoutes(fastify, db, auth, rooms, roomRules, pendingJoinRequests, broadcastSSE, removeSSESubscriber);
  registerUtilityRoutes(fastify, db, rooms);
  registerPageRoutes(fastify, db, rooms, roomRules);
  registerAssetRoutes(fastify);

  return fastify;
}
