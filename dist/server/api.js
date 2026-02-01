"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApi = createApi;
const fastify_1 = __importDefault(require("fastify"));
function createApi(db, auth, rooms) {
    const fastify = (0, fastify_1.default)({ logger: false });
    // Auth middleware
    const authenticate = async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            reply.code(401).send({ success: false, error: 'Unauthorized' });
            return;
        }
        const token = authHeader.slice(7);
        const result = auth.validateToken(token);
        if (!result.valid) {
            reply.code(401).send({ success: false, error: 'Invalid token' });
            return;
        }
        request.userId = result.userId;
        request.username = result.username;
    };
    // Register endpoint
    fastify.post('/api/register', async (request, reply) => {
        const { username, password, displayName } = request.body;
        const result = await auth.register(username, password, displayName);
        if ('error' in result) {
            reply.code(400).send({ success: false, error: result.error });
            return;
        }
        reply.send({
            success: true,
            data: { token: result.token, user: result.user },
        });
    });
    // Login endpoint
    fastify.post('/api/login', async (request, reply) => {
        const { username, password } = request.body;
        const result = await auth.login(username, password);
        if ('error' in result) {
            reply.code(401).send({ success: false, error: result.error });
            return;
        }
        reply.send({
            success: true,
            data: { token: result.token, user: result.user },
        });
    });
    // List active streams
    fastify.get('/api/streams', async (request, reply) => {
        const activeRooms = rooms.getActiveRooms();
        const publicStreams = activeRooms.filter((r) => !r.isPrivate);
        reply.send({
            success: true,
            data: {
                streams: publicStreams.map((r) => ({
                    id: r.id,
                    ownerId: r.ownerId,
                    ownerUsername: r.ownerUsername,
                    title: r.title,
                    isPrivate: r.isPrivate,
                    hasPassword: r.hasPassword,
                    viewerCount: r.viewerCount,
                    startedAt: r.startedAt,
                })),
            },
        });
    });
    // Get stream details
    fastify.get('/api/streams/:id', async (request, reply) => {
        const { id } = request.params;
        const room = rooms.getRoom(id);
        if (!room || !room.broadcaster) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        reply.send({
            success: true,
            data: {
                id: room.id,
                ownerId: room.stream.ownerId,
                ownerUsername: room.broadcaster.username,
                title: room.stream.title,
                isPrivate: room.stream.isPrivate,
                hasPassword: !!room.stream.password,
                viewerCount: room.viewers.size,
                startedAt: room.stream.startedAt,
            },
        });
    });
    // End stream (owner only)
    fastify.delete('/api/streams/:id', { preHandler: authenticate }, async (request, reply) => {
        const req = request;
        const { id } = req.params;
        const room = rooms.getRoom(id);
        if (!room) {
            reply.code(404).send({ success: false, error: 'Stream not found' });
            return;
        }
        if (room.stream.ownerId !== req.userId) {
            reply.code(403).send({ success: false, error: 'Forbidden' });
            return;
        }
        rooms.endRoom(id, 'ended');
        reply.send({ success: true });
    });
    // Get user profile
    fastify.get('/api/users/:id', async (request, reply) => {
        const { id } = request.params;
        const user = db.getUserById(id);
        if (!user) {
            reply.code(404).send({ success: false, error: 'User not found' });
            return;
        }
        reply.send({
            success: true,
            data: db.toUserPublic(user),
        });
    });
    // Update user profile
    fastify.put('/api/users/:id', { preHandler: authenticate }, async (request, reply) => {
        const req = request;
        const { id } = req.params;
        if (id !== req.userId) {
            reply.code(403).send({ success: false, error: 'Forbidden' });
            return;
        }
        const { displayName } = req.body;
        const updated = db.updateUser(id, { displayName });
        if (!updated) {
            reply.code(404).send({ success: false, error: 'User not found' });
            return;
        }
        const user = db.getUserById(id);
        reply.send({
            success: true,
            data: user ? db.toUserPublic(user) : null,
        });
    });
    // Health check
    fastify.get('/api/health', async (request, reply) => {
        reply.send({ success: true, data: { status: 'ok' } });
    });
    return fastify;
}
//# sourceMappingURL=api.js.map