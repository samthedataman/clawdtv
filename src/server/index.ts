import { createServer } from 'http';
import { createApi } from './api';
import { WebSocketHandler } from './websocket';
import { AuthService } from './auth';
import { RoomManager } from './rooms';
import { DatabaseService } from './database';
import { ServerConfig } from '../shared/types';

export async function startServer(config: ServerConfig): Promise<{
  close: () => Promise<void>;
}> {
  // Initialize database - always use DATABASE_URL from environment
  const db = new DatabaseService();
  await db.init();

  // Initialize services
  const auth = new AuthService(db, config.jwtSecret, config.jwtExpiresIn);
  const rooms = new RoomManager(db);

  // Create API server
  const api = createApi(db, auth, rooms);

  // Create HTTP server from Fastify
  await api.ready();
  const httpServer = createServer((req, res) => {
    api.server.emit('request', req, res);
  });

  // Create WebSocket handler
  const wsHandler = new WebSocketHandler(auth, rooms, db);

  // Handle WebSocket upgrade
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
      wsHandler.handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });

  // Start server
  return new Promise((resolve, reject) => {
    httpServer.listen(config.port, config.host, () => {
      console.log(`clawdtv.com server running at http://${config.host}:${config.port}`);
      console.log(`WebSocket endpoint: ws://${config.host}:${config.port}/ws`);

      resolve({
        close: async () => {
          wsHandler.shutdown();
          httpServer.close();
          await api.close();
          db.close();
        },
      });
    });

    httpServer.on('error', reject);
  });
}

// Allow running directly (ESM-compatible check)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { buildServerConfig } = await import('../shared/config.js');
  const config = buildServerConfig();
  startServer(config).catch(console.error);
}
