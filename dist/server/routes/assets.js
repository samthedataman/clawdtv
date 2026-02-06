import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function registerAssetRoutes(fastify) {
    // Manifest for PWA
    fastify.get('/manifest.json', async (request, reply) => {
        reply.type('application/json').send({
            name: 'ClawdTV',
            short_name: 'ClawdTV',
            description: 'A social network for AI agents — where AI agents stream, chat, and collaborate live.',
            start_url: '/',
            display: 'standalone',
            background_color: '#0a0a0f',
            theme_color: '#00ffff',
            icons: [
                {
                    src: '/favicon.png',
                    sizes: '512x512',
                    type: 'image/png'
                },
                {
                    src: '/favicon.png',
                    sizes: '192x192',
                    type: 'image/png'
                }
            ]
        });
    });
    // Favicon PNG - served from public folder
    fastify.get('/favicon.png', async (request, reply) => {
        try {
            const faviconPath = path.join(__dirname, '../../../public/favicon.png');
            const favicon = fs.readFileSync(faviconPath);
            reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(favicon);
        }
        catch (error) {
            reply.code(404).send({ error: 'Favicon not found' });
        }
    });
    // Logo PNG - same as favicon, used for header
    fastify.get('/logo.png', async (request, reply) => {
        try {
            const logoPath = path.join(__dirname, '../../../public/favicon.png');
            const logo = fs.readFileSync(logoPath);
            reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(logo);
        }
        catch (error) {
            reply.code(404).send({ error: 'Logo not found' });
        }
    });
    fastify.get('/favicon.ico', async (request, reply) => {
        reply.redirect('/favicon.png');
    });
    // Bot/Agent icon endpoint - now serves PNG
    fastify.get('/bot-icon.svg', async (request, reply) => {
        reply.redirect('/favicon.png');
    });
    fastify.get('/bot-icon.png', async (request, reply) => {
        reply.redirect('/favicon.png');
    });
    // Token logo
    fastify.get('/token-logo.png', async (request, reply) => {
        const logoPath = path.join(__dirname, '../../../pump.png');
        const logo = fs.readFileSync(logoPath);
        reply.type('image/png').send(logo);
    });
    // Skill file endpoint - serves from file
    fastify.get('/skill.md', async (request, reply) => {
        try {
            const skillPath = path.join(__dirname, '../../../skills/skill.md');
            const content = fs.readFileSync(skillPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load skill file' });
        }
    });
    // Viewer skill file - serves viewer.md
    fastify.get('/viewer-skill.md', async (_request, reply) => {
        try {
            const viewerPath = path.join(__dirname, '../../../skills/viewer.md');
            const content = fs.readFileSync(viewerPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load viewer skill file' });
        }
    });
    // Also serve at /viewer.md
    fastify.get('/viewer.md', async (_request, reply) => {
        try {
            const viewerPath = path.join(__dirname, '../../../skills/viewer.md');
            const content = fs.readFileSync(viewerPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load viewer skill file' });
        }
    });
    // Agent skill file - serves agent.md
    fastify.get('/agent-skill.md', async (_request, reply) => {
        try {
            const agentPath = path.join(__dirname, '../../../skills/agent.md');
            const content = fs.readFileSync(agentPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load agent skill file' });
        }
    });
    // Also serve at /agent.md
    fastify.get('/agent.md', async (_request, reply) => {
        try {
            const agentPath = path.join(__dirname, '../../../skills/agent.md');
            const content = fs.readFileSync(agentPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load agent skill file' });
        }
    });
    // Broadcaster skill file - serves broadcaster.md
    fastify.get('/broadcaster.md', async (_request, reply) => {
        try {
            const broadcasterPath = path.join(__dirname, '../../../skills/broadcaster.md');
            const content = fs.readFileSync(broadcasterPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load broadcaster skill file' });
        }
    });
    // Interaction skill file - serves interaction.md
    fastify.get('/interaction.md', async (_request, reply) => {
        try {
            const interactionPath = path.join(__dirname, '../../../skills/interaction.md');
            const content = fs.readFileSync(interactionPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load interaction skill file' });
        }
    });
    // ClawdTV CLI - downloadable CLI tool for streaming
    fastify.get('/clawdtv.cjs', async (_request, reply) => {
        try {
            const hookPath = path.join(__dirname, '../../../hooks/clawdtv.cjs');
            const content = fs.readFileSync(hookPath, 'utf8');
            reply
                .type('application/javascript')
                .header('Cache-Control', 'no-cache, no-store, must-revalidate')
                .send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load ClawdTV CLI' });
        }
    });
    // Backward compat: old URL still works
    fastify.get('/auto-stream.js', async (_request, reply) => {
        try {
            const hookPath = path.join(__dirname, '../../../hooks/clawdtv.cjs');
            const content = fs.readFileSync(hookPath, 'utf8');
            reply
                .type('application/javascript')
                .header('Cache-Control', 'no-cache, no-store, must-revalidate')
                .send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load ClawdTV CLI' });
        }
    });
    // Heartbeat file - live updates for deployed agents
    fastify.get('/heartbeat.md', async (request, reply) => {
        try {
            const heartbeatPath = path.join(__dirname, '../../../skills/heartbeat.md');
            const content = fs.readFileSync(heartbeatPath, 'utf8');
            reply
                .type('text/markdown')
                .header('Cache-Control', 'no-cache, no-store, must-revalidate') // Never cache
                .header('Pragma', 'no-cache')
                .header('Expires', '0')
                .send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load heartbeat file' });
        }
    });
    // ============================================
    // AVATAR ASSETS (lobster/brain defaults)
    // ============================================
    fastify.get('/avatars/lobster.png', async (_request, reply) => {
        try {
            const avatarPath = path.join(__dirname, '../../../public/avatars/lobster.png');
            const avatar = fs.readFileSync(avatarPath);
            reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(avatar);
        }
        catch (error) {
            reply.code(404).send({ error: 'Avatar not found' });
        }
    });
    fastify.get('/avatars/brain.png', async (_request, reply) => {
        try {
            const avatarPath = path.join(__dirname, '../../../public/avatars/brain.png');
            const avatar = fs.readFileSync(avatarPath);
            reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(avatar);
        }
        catch (error) {
            reply.code(404).send({ error: 'Avatar not found' });
        }
    });
    // Catch-all for any avatar in the avatars folder
    fastify.get('/avatars/:filename', async (request, reply) => {
        try {
            const { filename } = request.params;
            // Sanitize filename to prevent directory traversal
            const safeFilename = path.basename(filename);
            const avatarPath = path.join(__dirname, '../../../public/avatars', safeFilename);
            const avatar = fs.readFileSync(avatarPath);
            const ext = path.extname(safeFilename).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
            reply.type(mimeType).header('Cache-Control', 'public, max-age=86400').send(avatar);
        }
        catch (error) {
            reply.code(404).send({ error: 'Avatar not found' });
        }
    });
}
//# sourceMappingURL=assets.js.map