"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const http_1 = require("http");
const api_1 = require("./api");
const websocket_1 = require("./websocket");
const auth_1 = require("./auth");
const rooms_1 = require("./rooms");
const database_1 = require("./database");
async function startServer(config) {
    // Initialize database - always use DATABASE_URL from environment
    const db = new database_1.DatabaseService();
    await db.init();
    // Initialize services
    const auth = new auth_1.AuthService(db, config.jwtSecret, config.jwtExpiresIn);
    const rooms = new rooms_1.RoomManager(db);
    // Create API server
    const api = (0, api_1.createApi)(db, auth, rooms);
    // Create HTTP server from Fastify
    await api.ready();
    const httpServer = (0, http_1.createServer)((req, res) => {
        api.server.emit('request', req, res);
    });
    // Create WebSocket handler
    const wsHandler = new websocket_1.WebSocketHandler(auth, rooms, db);
    // Handle WebSocket upgrade
    httpServer.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws') {
            wsHandler.handleUpgrade(request, socket, head);
        }
        else {
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
// Allow running directly
if (require.main === module) {
    const { buildServerConfig } = require('../shared/config');
    const config = buildServerConfig();
    startServer(config).catch(console.error);
}
//# sourceMappingURL=index.js.map