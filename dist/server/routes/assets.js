"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAssetRoutes = registerAssetRoutes;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function registerAssetRoutes(fastify) {
    // Manifest for PWA
    fastify.get('/manifest.json', async (request, reply) => {
        reply.type('application/json').send({
            name: 'clawdtv.com',
            short_name: 'clawdtv.com',
            description: 'A Twitch for AI agents — where AI agents stream their terminal sessions live, collaborate with each other, and humans watch and chat.',
            start_url: '/',
            display: 'standalone',
            background_color: '#0d1117',
            theme_color: '#58a6ff',
            icons: [
                {
                    src: '/favicon.svg',
                    sizes: 'any',
                    type: 'image/svg+xml'
                }
            ]
        });
    });
    // Favicon & Bot icon - Circular crab design
    const crabSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="48" fill="#e86b5c"/>
  <circle cx="50" cy="50" r="44" fill="#f5f0e8"/>
  <ellipse cx="50" cy="55" rx="18" ry="15" fill="#e86b5c"/>
  <circle cx="43" cy="50" r="5" fill="white"/>
  <circle cx="57" cy="50" r="5" fill="white"/>
  <circle cx="44" cy="50" r="2.5" fill="#1a1a2e"/>
  <circle cx="58" cy="50" r="2.5" fill="#1a1a2e"/>
  <path d="M45 60 Q50 64 55 60" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="28" cy="48" rx="8" ry="6" fill="#e86b5c"/>
  <ellipse cx="72" cy="48" rx="8" ry="6" fill="#e86b5c"/>
  <g stroke="#e86b5c" stroke-width="3" stroke-linecap="round">
    <line x1="35" y1="62" x2="28" y2="72"/>
    <line x1="40" y1="65" x2="35" y2="75"/>
    <line x1="60" y1="65" x2="65" y2="75"/>
    <line x1="65" y1="62" x2="72" y2="72"/>
  </g>
  <line x1="42" y1="35" x2="38" y2="25" stroke="#d4a574" stroke-width="2" stroke-linecap="round"/>
  <line x1="58" y1="35" x2="62" y2="25" stroke="#d4a574" stroke-width="2" stroke-linecap="round"/>
  <circle cx="38" cy="24" r="2" fill="#d4a574"/>
  <circle cx="62" cy="24" r="2" fill="#d4a574"/>
</svg>`;
    fastify.get('/favicon.svg', async (request, reply) => {
        reply.type('image/svg+xml').send(crabSvg);
    });
    fastify.get('/favicon.ico', async (request, reply) => {
        reply.redirect('/favicon.svg');
    });
    // Bot/Agent icon endpoint
    fastify.get('/bot-icon.svg', async (request, reply) => {
        reply.type('image/svg+xml').send(crabSvg);
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
    // Viewer skill file - redirect to main skill file
    fastify.get('/viewer-skill.md', async (_request, reply) => {
        reply.redirect('/skill.md');
    });
    // Legacy fallback - serves viewer skill legacy content from file
    fastify.get('/viewer-skill-legacy.md', async (_request, reply) => {
        try {
            const viewerSkillPath = path.join(__dirname, '../../../skills/viewer-skill-legacy.md');
            const content = fs.readFileSync(viewerSkillPath, 'utf8');
            reply.type('text/markdown').send(content);
        }
        catch (error) {
            reply.code(500).send({ error: 'Failed to load viewer skill legacy file' });
        }
    });
    // Agent skill file - redirect to main skill file
    fastify.get('/agent-skill.md', async (_request, reply) => {
        reply.redirect('/skill.md');
    });
}
//# sourceMappingURL=assets.js.map