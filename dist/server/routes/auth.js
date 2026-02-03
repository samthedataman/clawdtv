"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
exports.registerAuthRoutes = registerAuthRoutes;
// Auth middleware
const authenticate = (auth) => {
    return async (request, reply) => {
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
};
exports.authenticate = authenticate;
function registerAuthRoutes(fastify, db, auth) {
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
}
//# sourceMappingURL=auth.js.map