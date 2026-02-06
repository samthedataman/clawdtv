import { getAgentFromRequest } from '../helpers/agentAuth.js';
export function registerProfileRoutes(fastify, db, rooms) {
    // Get agent profile by ID (public)
    fastify.get('/api/agents/:id', async (request, reply) => {
        const { id } = request.params;
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        // Check if agent is currently streaming
        const activeStream = await db.getActiveAgentStream(id);
        const isStreaming = !!activeStream;
        // Get stream history stats
        const { total: totalStreams } = await db.getAgentStreamsByAgentId(id, 1, 0);
        reply.send({
            success: true,
            data: {
                agent: db.toAgentPublic(agent, isStreaming),
                stats: {
                    totalStreams,
                    totalViewers: agent.totalViewers,
                    followerCount: agent.followerCount || 0,
                },
                currentStream: activeStream ? {
                    roomId: activeStream.roomId,
                    title: activeStream.title,
                    startedAt: activeStream.startedAt,
                    watchUrl: `https://clawdtv.com/watch/${activeStream.roomId}`,
                } : null,
            },
        });
    });
    // Update own profile (requires auth)
    fastify.post('/api/agents/:id/profile', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { id } = request.params;
        // Agents can only update their own profile
        if (agent.id !== id) {
            reply.code(403).send({ success: false, error: 'You can only update your own profile' });
            return;
        }
        const { bio, avatarUrl, websiteUrl, socialLinks } = request.body;
        // Validate inputs
        if (bio && bio.length > 500) {
            reply.code(400).send({ success: false, error: 'Bio must be 500 characters or less' });
            return;
        }
        if (avatarUrl && avatarUrl.length > 500) {
            reply.code(400).send({ success: false, error: 'Avatar URL too long' });
            return;
        }
        if (websiteUrl && websiteUrl.length > 200) {
            reply.code(400).send({ success: false, error: 'Website URL too long' });
            return;
        }
        await db.updateAgentProfile(id, { bio, avatarUrl, websiteUrl, socialLinks });
        await db.updateAgentLastSeen(id);
        const updatedAgent = await db.getAgentById(id);
        reply.send({
            success: true,
            data: {
                agent: updatedAgent ? db.toAgentPublic(updatedAgent, false) : null,
                message: 'Profile updated',
            },
        });
    });
    // Get agent's stream history
    fastify.get('/api/agents/:id/streams', async (request, reply) => {
        const { id } = request.params;
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
        const offset = parseInt(request.query.offset || '0', 10);
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const { streams, total } = await db.getAgentStreamsByAgentId(id, limit, offset);
        reply.send({
            success: true,
            data: {
                agentName: agent.name,
                streams: streams.map(s => ({
                    id: s.id,
                    roomId: s.roomId,
                    title: s.title,
                    startedAt: s.startedAt,
                    endedAt: s.endedAt,
                    duration: s.endedAt ? s.endedAt - s.startedAt : null,
                    peakViewers: s.peakViewers,
                })),
                total,
                limit,
                offset,
            },
        });
    });
    // Follow an agent
    fastify.post('/api/agents/:id/follow', async (request, reply) => {
        const follower = await getAgentFromRequest(request, db);
        if (!follower) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { id: followingId } = request.params;
        // Can't follow yourself
        if (follower.id === followingId) {
            reply.code(400).send({ success: false, error: "You can't follow yourself" });
            return;
        }
        // Check if target agent exists
        const targetAgent = await db.getAgentById(followingId);
        if (!targetAgent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const success = await db.followAgent(follower.id, followingId);
        await db.updateAgentLastSeen(follower.id);
        reply.send({
            success,
            data: {
                following: true,
                followerCount: (await db.getAgentById(followingId))?.followerCount || 0,
            },
        });
    });
    // Unfollow an agent
    fastify.delete('/api/agents/:id/follow', async (request, reply) => {
        const follower = await getAgentFromRequest(request, db);
        if (!follower) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { id: followingId } = request.params;
        await db.unfollowAgent(follower.id, followingId);
        await db.updateAgentLastSeen(follower.id);
        reply.send({
            success: true,
            data: {
                following: false,
                followerCount: (await db.getAgentById(followingId))?.followerCount || 0,
            },
        });
    });
    // Get agent's followers
    fastify.get('/api/agents/:id/followers', async (request, reply) => {
        const { id } = request.params;
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
        const offset = parseInt(request.query.offset || '0', 10);
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const { followers, total } = await db.getAgentFollowers(id, limit, offset);
        reply.send({
            success: true,
            data: {
                agentName: agent.name,
                followers,
                total,
                limit,
                offset,
            },
        });
    });
    // List all agents (directory)
    fastify.get('/api/agents', async (request, reply) => {
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
        const offset = parseInt(request.query.offset || '0', 10);
        const sort = request.query.sort || 'recent';
        const query = request.query.q?.toLowerCase();
        let agents = await db.getAllAgents();
        // Filter by search query
        if (query) {
            agents = agents.filter(a => a.name.toLowerCase().includes(query) ||
                a.bio?.toLowerCase().includes(query));
        }
        // Sort
        switch (sort) {
            case 'followers':
                agents.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
                break;
            case 'streams':
                agents.sort((a, b) => b.streamCount - a.streamCount);
                break;
            case 'viewers':
                agents.sort((a, b) => b.totalViewers - a.totalViewers);
                break;
            case 'recent':
            default:
                agents.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
                break;
        }
        const total = agents.length;
        const paginated = agents.slice(offset, offset + limit);
        // Check which agents are currently streaming
        const activeStreams = await db.getActiveAgentStreams();
        const streamingIds = new Set(activeStreams.map(s => s.agentId));
        reply.send({
            success: true,
            data: {
                agents: paginated.map(a => db.toAgentPublic(a, streamingIds.has(a.id))),
                total,
                limit,
                offset,
            },
        });
    });
    // ============================================
    // CTV COINS / TIPPING
    // ============================================
    // Get agent's CTV coin balance
    fastify.get('/api/agents/:id/balance', async (request, reply) => {
        const { id } = request.params;
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const balance = await db.getAgentBalance(id);
        reply.send({
            success: true,
            data: {
                agentId: id,
                agentName: agent.name,
                balance,
            },
        });
    });
    // Tip another agent with CTV coins
    fastify.post('/api/agents/:id/tip', async (request, reply) => {
        const sender = await getAgentFromRequest(request, db);
        if (!sender) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { id: recipientId } = request.params;
        const { amount, message } = request.body;
        if (!amount || typeof amount !== 'number') {
            reply.code(400).send({ success: false, error: 'Amount is required and must be a number' });
            return;
        }
        const result = await db.tipAgent(sender.id, recipientId, amount, message);
        await db.updateAgentLastSeen(sender.id);
        if (!result.success) {
            reply.code(400).send({ success: false, error: result.error });
            return;
        }
        // Get updated balances
        const senderBalance = await db.getAgentBalance(sender.id);
        const recipientAgent = await db.getAgentById(recipientId);
        reply.send({
            success: true,
            data: {
                transaction: result.transaction,
                senderBalance,
                recipientName: recipientAgent?.name,
                message: `Sent ${amount} CTV to ${recipientAgent?.name}`,
            },
        });
    });
    // Get agent's transaction history
    fastify.get('/api/agents/:id/transactions', async (request, reply) => {
        const { id } = request.params;
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
        const offset = parseInt(request.query.offset || '0', 10);
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const { transactions, total } = await db.getAgentTransactions(id, limit, offset);
        // Enrich transactions with agent names
        const enriched = await Promise.all(transactions.map(async (tx) => {
            const fromAgent = await db.getAgentById(tx.fromAgentId);
            const toAgent = await db.getAgentById(tx.toAgentId);
            return {
                ...tx,
                fromAgentName: fromAgent?.name || 'Unknown',
                toAgentName: toAgent?.name || 'Unknown',
            };
        }));
        reply.send({
            success: true,
            data: {
                agentName: agent.name,
                transactions: enriched,
                total,
                limit,
                offset,
            },
        });
    });
    // ============================================
    // POKES (Social Interactions)
    // ============================================
    const VALID_POKE_TYPES = ['poke', 'wave', 'high-five', 'salute'];
    // Poke another agent
    fastify.post('/api/agents/:id/poke', async (request, reply) => {
        const sender = await getAgentFromRequest(request, db);
        if (!sender) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { id: recipientId } = request.params;
        const pokeType = (request.body.pokeType || 'poke');
        const message = request.body.message;
        if (!VALID_POKE_TYPES.includes(pokeType)) {
            reply.code(400).send({
                success: false,
                error: `Invalid poke type. Valid types: ${VALID_POKE_TYPES.join(', ')}`,
            });
            return;
        }
        // Rate limiting: max 5 pokes per minute to same agent
        const recentCount = await db.getRecentPokesCount(sender.id, recipientId, 60000);
        if (recentCount >= 5) {
            reply.code(429).send({
                success: false,
                error: 'Too many pokes! Wait a minute before poking this agent again.',
            });
            return;
        }
        const result = await db.pokeAgent(sender.id, recipientId, pokeType, message);
        await db.updateAgentLastSeen(sender.id);
        if (!result.success) {
            reply.code(400).send({ success: false, error: result.error });
            return;
        }
        const recipientAgent = await db.getAgentById(recipientId);
        const pokeEmoji = {
            'poke': '👉',
            'wave': '👋',
            'high-five': '🙌',
            'salute': '🫡',
        }[pokeType];
        reply.send({
            success: true,
            data: {
                poke: result.poke,
                recipientName: recipientAgent?.name,
                message: `${pokeEmoji} ${sender.name} ${pokeType === 'poke' ? 'poked' : pokeType === 'wave' ? 'waved at' : pokeType === 'high-five' ? 'high-fived' : 'saluted'} ${recipientAgent?.name}`,
            },
        });
    });
    // Get pokes received/sent
    fastify.get('/api/agents/:id/pokes', async (request, reply) => {
        const { id } = request.params;
        const direction = (request.query.direction || 'received');
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const pokes = await db.getAgentPokes(id, direction, limit);
        // Enrich with agent names
        const enriched = await Promise.all(pokes.map(async (p) => {
            const fromAgent = await db.getAgentById(p.fromAgentId);
            const toAgent = await db.getAgentById(p.toAgentId);
            return {
                ...p,
                fromAgentName: fromAgent?.name || 'Unknown',
                toAgentName: toAgent?.name || 'Unknown',
            };
        }));
        reply.send({
            success: true,
            data: {
                agentName: agent.name,
                pokes: enriched,
                direction,
            },
        });
    });
    // ============================================
    // WALLET & WITHDRAWALS
    // ============================================
    // Link a Solana wallet to agent
    fastify.post('/api/agents/:id/wallet', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { id } = request.params;
        if (agent.id !== id) {
            reply.code(403).send({ success: false, error: 'You can only set your own wallet' });
            return;
        }
        const { walletAddress } = request.body;
        if (!walletAddress) {
            reply.code(400).send({ success: false, error: 'walletAddress is required' });
            return;
        }
        const success = await db.setAgentWallet(id, walletAddress);
        if (!success) {
            reply.code(400).send({ success: false, error: 'Invalid Solana wallet address' });
            return;
        }
        reply.send({
            success: true,
            data: {
                walletAddress,
                message: 'Wallet linked successfully! You can now request withdrawals.',
            },
        });
    });
    // Get agent's wallet info
    fastify.get('/api/agents/:id/wallet', async (request, reply) => {
        const { id } = request.params;
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const wallet = await db.getAgentWallet(id);
        const balance = await db.getAgentBalance(id);
        reply.send({
            success: true,
            data: {
                agentId: id,
                agentName: agent.name,
                walletAddress: wallet,
                balance,
                hasWallet: !!wallet,
            },
        });
    });
    // Request a CTV withdrawal
    fastify.post('/api/agents/:id/withdraw', async (request, reply) => {
        const agent = await getAgentFromRequest(request, db);
        if (!agent) {
            reply.code(401).send({ success: false, error: 'Invalid or missing API key' });
            return;
        }
        const { id } = request.params;
        if (agent.id !== id) {
            reply.code(403).send({ success: false, error: 'You can only withdraw from your own account' });
            return;
        }
        const { amount } = request.body;
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            reply.code(400).send({ success: false, error: 'amount is required and must be a positive number' });
            return;
        }
        const result = await db.requestWithdrawal(id, amount);
        if (!result.success) {
            reply.code(400).send({ success: false, error: result.error });
            return;
        }
        const newBalance = await db.getAgentBalance(id);
        reply.send({
            success: true,
            data: {
                withdrawalId: result.withdrawalId,
                amount,
                newBalance,
                message: `Withdrawal request submitted! ${amount} CTV will be sent to your wallet once processed.`,
            },
        });
    });
    // Get agent's withdrawal history
    fastify.get('/api/agents/:id/withdrawals', async (request, reply) => {
        const { id } = request.params;
        const limit = Math.min(parseInt(request.query.limit || '20'), 50);
        const agent = await db.getAgentById(id);
        if (!agent) {
            reply.code(404).send({ success: false, error: 'Agent not found' });
            return;
        }
        const withdrawals = await db.getAgentWithdrawals(id, limit);
        const balance = await db.getAgentBalance(id);
        reply.send({
            success: true,
            data: {
                agentName: agent.name,
                balance,
                withdrawals,
            },
        });
    });
}
//# sourceMappingURL=profile.js.map