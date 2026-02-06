import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Pre-generate vignette overlay (dark edges, transparent center)
async function createVignetteOverlay(width, height) {
    // Create radial gradient vignette using SVG
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
          <stop offset="60%" style="stop-color:rgb(0,0,0);stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.8" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#vignette)" />
    </svg>
  `;
    return Buffer.from(svg);
}
// Cache for vignette overlay
let vignetteCache = null;
export function registerThumbnailRoutes(fastify) {
    // Stream thumbnail with vignette effect
    fastify.get('/api/thumbnail', async (_request, reply) => {
        try {
            // Path to favicon
            const faviconPath = path.join(__dirname, '../../../public/favicon.png');
            // Load and get metadata
            const image = sharp(faviconPath);
            const metadata = await image.metadata();
            const width = metadata.width || 320;
            const height = metadata.height || 180;
            // Create or use cached vignette
            if (!vignetteCache || vignetteCache.width !== width || vignetteCache.height !== height) {
                vignetteCache = {
                    buffer: await createVignetteOverlay(width, height),
                    width,
                    height,
                };
            }
            // Composite vignette over favicon
            const result = await sharp(faviconPath)
                .composite([
                {
                    input: vignetteCache.buffer,
                    blend: 'over',
                },
            ])
                .png()
                .toBuffer();
            reply
                .header('Content-Type', 'image/png')
                .header('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
                .send(result);
        }
        catch (error) {
            console.error('Thumbnail generation error:', error);
            reply.code(500).send({ success: false, error: 'Failed to generate thumbnail' });
        }
    });
    // Stream-specific thumbnail (for future customization per stream)
    fastify.get('/api/thumbnail/:roomId', async (request, reply) => {
        try {
            const faviconPath = path.join(__dirname, '../../../public/favicon.png');
            // Load and get metadata
            const image = sharp(faviconPath);
            const metadata = await image.metadata();
            const width = metadata.width || 320;
            const height = metadata.height || 180;
            // Create vignette with slight color tint based on roomId hash
            const hash = request.params.roomId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const hue = hash % 360;
            // Create SVG with colored vignette
            const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="vignette" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
              <stop offset="0%" style="stop-color:hsl(${hue}, 80%, 50%);stop-opacity:0" />
              <stop offset="50%" style="stop-color:rgb(0,0,0);stop-opacity:0.1" />
              <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.85" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#vignette)" />
        </svg>
      `;
            const result = await sharp(faviconPath)
                .composite([
                {
                    input: Buffer.from(svg),
                    blend: 'over',
                },
            ])
                .png()
                .toBuffer();
            reply
                .header('Content-Type', 'image/png')
                .header('Cache-Control', 'public, max-age=3600')
                .send(result);
        }
        catch (error) {
            console.error('Thumbnail generation error:', error);
            reply.code(500).send({ success: false, error: 'Failed to generate thumbnail' });
        }
    });
}
//# sourceMappingURL=thumbnail.js.map