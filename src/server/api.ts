import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth';
import { DatabaseService } from './database';
import { RoomManager } from './rooms';
import { ApiResponse, AuthResponse, StreamListResponse, UserPublic } from '../shared/types';

interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  username?: string;
}

export function createApi(
  db: DatabaseService,
  auth: AuthService,
  rooms: RoomManager
): FastifyInstance {
  const fastify = Fastify({ logger: false });

  // Auth middleware
  const authenticate = async (request: AuthenticatedRequest, reply: FastifyReply) => {
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
  fastify.post<{
    Body: { username: string; password: string; displayName?: string };
  }>('/api/register', async (request, reply) => {
    const { username, password, displayName } = request.body;

    const result = await auth.register(username, password, displayName);
    if ('error' in result) {
      reply.code(400).send({ success: false, error: result.error } as ApiResponse);
      return;
    }

    reply.send({
      success: true,
      data: { token: result.token, user: result.user },
    } as ApiResponse<AuthResponse>);
  });

  // Login endpoint
  fastify.post<{
    Body: { username: string; password: string };
  }>('/api/login', async (request, reply) => {
    const { username, password } = request.body;

    const result = await auth.login(username, password);
    if ('error' in result) {
      reply.code(401).send({ success: false, error: result.error } as ApiResponse);
      return;
    }

    reply.send({
      success: true,
      data: { token: result.token, user: result.user },
    } as ApiResponse<AuthResponse>);
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
    } as ApiResponse<StreamListResponse>);
  });

  // Get stream details
  fastify.get<{
    Params: { id: string };
  }>('/api/streams/:id', async (request, reply) => {
    const { id } = request.params;
    const room = rooms.getRoom(id);

    if (!room || !room.broadcaster) {
      reply.code(404).send({ success: false, error: 'Stream not found' } as ApiResponse);
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
    } as ApiResponse);
  });

  // End stream (owner only)
  fastify.delete<{
    Params: { id: string };
  }>(
    '/api/streams/:id',
    { preHandler: authenticate as any },
    async (request, reply) => {
      const req = request as AuthenticatedRequest & { params: { id: string } };
      const { id } = req.params;
      const room = rooms.getRoom(id);

      if (!room) {
        reply.code(404).send({ success: false, error: 'Stream not found' } as ApiResponse);
        return;
      }

      if (room.stream.ownerId !== req.userId) {
        reply.code(403).send({ success: false, error: 'Forbidden' } as ApiResponse);
        return;
      }

      rooms.endRoom(id, 'ended');
      reply.send({ success: true } as ApiResponse);
    }
  );

  // Get user profile
  fastify.get<{
    Params: { id: string };
  }>('/api/users/:id', async (request, reply) => {
    const { id } = request.params;
    const user = db.getUserById(id);

    if (!user) {
      reply.code(404).send({ success: false, error: 'User not found' } as ApiResponse);
      return;
    }

    reply.send({
      success: true,
      data: db.toUserPublic(user),
    } as ApiResponse<UserPublic>);
  });

  // Update user profile
  fastify.put<{
    Params: { id: string };
    Body: { displayName?: string };
  }>(
    '/api/users/:id',
    { preHandler: authenticate as any },
    async (request, reply) => {
      const req = request as AuthenticatedRequest & { params: { id: string }; body: { displayName?: string } };
      const { id } = req.params;

      if (id !== req.userId) {
        reply.code(403).send({ success: false, error: 'Forbidden' } as ApiResponse);
        return;
      }

      const { displayName } = req.body;
      const updated = db.updateUser(id, { displayName });

      if (!updated) {
        reply.code(404).send({ success: false, error: 'User not found' } as ApiResponse);
        return;
      }

      const user = db.getUserById(id);
      reply.send({
        success: true,
        data: user ? db.toUserPublic(user) : null,
      } as ApiResponse<UserPublic | null>);
    }
  );

  // Health check
  fastify.get('/api/health', async (request, reply) => {
    reply.send({ success: true, data: { status: 'ok' } });
  });

  return fastify;
}
