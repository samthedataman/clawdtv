import Fastify, { FastifyInstance, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';

// Extend FastifyReply to include our view decorator
declare module 'fastify' {
  interface FastifyReply {
    view(template: string, data?: object): FastifyReply;
  }
}
import { Eta } from 'eta';
import * as path from 'path';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { AuthService } from './auth.js';
import { DatabaseService } from './database.js';
import { RoomManager } from './rooms.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerDiscoveryRoutes } from './routes/discovery.js';
import { registerAgentRoutes } from './routes/agent.js';
import { registerBroadcastRoutes } from './routes/broadcast.js';
import { registerWatchingRoutes } from './routes/watching.js';
import { registerUtilityRoutes } from './routes/utility.js';
import { registerPageRoutes } from './routes/pages.js';
import { registerAssetRoutes } from './routes/assets.js';

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

  // 🔥 HOT-SWAP: Toggle between React and Eta via environment variable
  // Default to React in production, Eta in development (unless explicitly set)
  const USE_REACT = process.env.USE_REACT_FRONTEND === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.USE_REACT_FRONTEND !== 'false');

  if (USE_REACT) {
    console.log('🚀 [Hot-Swap] Serving REACT frontend from dist-rebuild/');
  } else {
    console.log('📄 [Hot-Swap] Serving ETA templates (classic mode)');
  }

  if (!USE_REACT) {
    // Register view engine (Eta templates) - CLASSIC MODE
    const templatesDir = path.join(__dirname, '../../templates');
    const eta = new Eta({ views: templatesDir, autoEscape: true });

    // Custom view decorator since @fastify/view has compatibility issues with Eta 3.x
    fastify.decorateReply('view', function(this: FastifyReply, template: string, data: object = {}) {
      const html = eta.render(template, data);
      this.type('text/html').send(html);
      return this;
    });

    // Register static file serving for classic public folder
    fastify.register(fastifyStatic, {
      root: path.join(__dirname, '../../public'),
      prefix: '/',
    });
  } else {
    // Register static file serving for React build - REACT MODE
    // wildcard: false prevents conflict with SPA catch-all
    fastify.register(fastifyStatic, {
      root: path.join(__dirname, '../../dist-rebuild'),
      prefix: '/',
      wildcard: false,
    });
  }

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
  registerAssetRoutes(fastify);

  // Conditional page routes: Eta templates OR React SPA
  if (!USE_REACT) {
    // Classic mode: Register Eta template page routes
    registerPageRoutes(fastify, db, rooms, roomRules);
  } else {
    // React mode: SPA catch-all route (MUST be registered LAST)
    fastify.get('/*', async (_request, reply) => {
      // All non-API routes serve the React index.html
      return reply.sendFile('index.html');
    });
  }

  return fastify;
}
