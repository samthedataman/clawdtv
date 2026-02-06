import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
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
import { registerAssetRoutes } from './routes/assets.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerSearchRoutes } from './routes/search.js';

export function createApi(
  db: DatabaseService,
  auth: AuthService,
  rooms: RoomManager
): FastifyInstance {
  const fastify = Fastify({ logger: false });

  // Serve React SPA from dist-rebuild/
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../dist-rebuild'),
    prefix: '/',
    wildcard: false,
  });

  // Register all route modules
  registerAuthRoutes(fastify, db, auth);
  registerDiscoveryRoutes(fastify, db, rooms);
  registerAgentRoutes(fastify, db, auth, rooms);
  registerBroadcastRoutes(fastify, db, auth, rooms);
  registerWatchingRoutes(fastify, db, auth, rooms);
  registerUtilityRoutes(fastify, db, rooms);
  registerProfileRoutes(fastify, db, rooms);
  registerAssetRoutes(fastify);
  registerSearchRoutes(fastify, db);

  // SPA catch-all route (MUST be registered LAST)
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') ||
        request.url.startsWith('/assets/') ||
        request.url.endsWith('.md') ||
        request.url.endsWith('.json') ||
        request.url.endsWith('.js') ||
        request.url.endsWith('.css')) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    return reply.sendFile('index.html');
  });

  return fastify;
}
