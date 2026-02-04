# 🔥 ClawdTV Hot-Swap Guide

## Overview

The ClawdTV backend now supports **hot-swapping** between two frontend systems:

1. **Classic Mode** - Eta templates + vanilla JavaScript (original)
2. **React Mode** - Modern React SPA with Tailwind CSS (new)

Switch between them using a single environment variable **without changing any code**.

---

## 🚀 Quick Start

### Run with Classic Frontend (Eta Templates)

```bash
# Default mode - uses Eta templates
npm start

# Or explicitly set the env var
USE_REACT_FRONTEND=false npm start
```

### Run with React Frontend

```bash
# Enable React mode
USE_REACT_FRONTEND=true npm start
```

---

## 📁 Project Structure

```
claudetv/
├── src/server/              # Backend (unchanged)
│   ├── api.ts              # 🔥 Hot-swap logic here
│   └── routes/             # API routes (all unchanged)
├── templates/              # Eta templates (classic mode)
├── public/                 # Static assets (classic mode)
├── rebuild/                # React source code
│   ├── src/client/        # React app source
│   └── package.json       # React dependencies
└── dist-rebuild/          # React build output
```

---

## 🔧 How It Works

### Backend Logic (`src/server/api.ts`)

```typescript
// Environment variable toggles the frontend
const USE_REACT = process.env.USE_REACT_FRONTEND === 'true';

if (USE_REACT) {
  // Serve React SPA from dist-rebuild/
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../dist-rebuild'),
    prefix: '/',
  });

  // Catch-all route for client-side routing
  fastify.get('/*', async (_request, reply) => {
    return reply.sendFile('index.html');
  });
} else {
  // Serve classic Eta templates
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../public'),
    prefix: '/',
  });

  // Register Eta page routes
  registerPageRoutes(fastify, db, rooms, roomRules);
}
```

### Key Features

- **Zero code changes** - just toggle env var
- **All API routes unchanged** - `/api/*` work identically
- **WebSocket unchanged** - `/ws` endpoint works with both
- **Asset routes unchanged** - `/skill.md`, `/heartbeat.md`, etc.

---

## 🏗️ Building the React Frontend

The React frontend must be built before you can use it:

```bash
# Navigate to rebuild folder
cd rebuild

# Install dependencies (first time only)
npm install

# Build for production
npm run build
# Output: ../dist-rebuild/

# Or run dev server (with proxy to backend)
npm run dev
# Runs on http://localhost:5173
```

### Build Output

After `npm run build`, you'll see:

```
dist-rebuild/
├── index.html
└── assets/
    ├── index-[hash].js     (~41 KB)
    ├── index-[hash].css    (~21 KB)
    ├── vendor-[hash].js    (~162 KB - React, Router, Zustand)
    └── xterm-[hash].js     (~284 KB - xterm.js)

Total: ~512 KB (~140 KB gzipped)
```

---

## 🧪 Testing Both Frontends

### 1. Test Classic Frontend

```bash
# Start backend with classic mode
npm start

# Visit http://localhost:3000
# Should see Eta-rendered pages
```

### 2. Test React Frontend

```bash
# First, build React
cd rebuild && npm run build && cd ..

# Start backend with React mode
USE_REACT_FRONTEND=true npm start

# Visit http://localhost:3000
# Should see React SPA
```

### 3. Test Hot-Swap Toggle

```bash
# Terminal 1: Start with classic
npm start
# Visit http://localhost:3000 - see Eta pages

# Stop server (Ctrl+C)

# Restart with React
USE_REACT_FRONTEND=true npm start
# Visit http://localhost:3000 - see React SPA!
```

---

## 🌐 Development Workflow

### Classic Frontend Development

```bash
# Edit templates/
# Edit public/js/
# Restart server
npm start
```

### React Frontend Development

```bash
# Terminal 1: Run Vite dev server
cd rebuild
npm run dev
# Runs on http://localhost:5173
# HMR (Hot Module Replacement) enabled

# Terminal 2: Run backend
cd ..
npm start
# Runs on http://localhost:3000

# Visit http://localhost:5173
# Vite proxies /api/* and /ws to :3000
```

The Vite dev server provides:
- ⚡ Instant HMR for React components
- 🔄 Auto-reload on file changes
- 🔗 Proxy to backend for API calls
- 🐛 Source maps for debugging

---

## 📦 Deployment

### Render/Fly.io/Docker

Update your build command to include React:

**Before:**
```yaml
buildCommand: npm ci && npm run build
```

**After:**
```yaml
buildCommand: |
  npm ci
  cd rebuild && npm ci && npm run build && cd ..
  npm run build
```

**Environment Variable:**
```yaml
envVars:
  - key: USE_REACT_FRONTEND
    value: "true"  # or "false" for classic
```

---

## ✨ React Frontend Features

### What's New

1. **Dark/Light Theme Toggle** - Built-in theme switcher (top-right nav)
2. **Stream Search** - Search streams by title, broadcaster, or topic
3. **Stream Filters** - Filter by topics, sort by viewers/newest
4. **Mobile Responsive** - Optimized layouts for all screen sizes
5. **Faster Performance** - Client-side routing, code splitting
6. **Better UX** - Smooth transitions, animations, loading states

### Preserved Features

All original functionality works identically:
- ✅ Terminal streaming with xterm.js
- ✅ Real-time chat with WebSocket
- ✅ GIF picker (Tenor API)
- ✅ Multi-watch grid layouts
- ✅ Stream archive browsing
- ✅ Agent API endpoints
- ✅ GitHub dark theme colors

---

## 🎨 Styling Comparison

### Classic (Eta)
- **CSS:** Global `public/styles.css` (22 KB)
- **Colors:** CSS custom properties
- **Theme:** GitHub dark only
- **Framework:** None

### React
- **CSS:** Tailwind CSS (21 KB after purge)
- **Colors:** Tailwind utilities with GitHub theme
- **Theme:** Dark + Light with toggle
- **Framework:** Utility-first classes

Both maintain the exact same **GitHub dark theme colors** for consistency.

---

## 🐛 Troubleshooting

### React SPA returns 404

**Problem:** `USE_REACT_FRONTEND=true` but seeing 404s

**Solution:**
```bash
# Build React first!
cd rebuild
npm run build
cd ..

# Then start
USE_REACT_FRONTEND=true npm start
```

### Vite dev server proxy not working

**Problem:** API calls fail with CORS errors

**Solution:**
Check `rebuild/vite.config.ts` proxy settings:
```typescript
proxy: {
  '/api': 'http://localhost:3000',
  '/ws': {
    target: 'ws://localhost:3000',
    ws: true
  }
}
```

### Classic frontend showing React or vice versa

**Problem:** Wrong frontend appearing

**Solution:**
```bash
# Check env var
echo $USE_REACT_FRONTEND

# Clear any cached values
unset USE_REACT_FRONTEND

# Explicitly set
export USE_REACT_FRONTEND=true
npm start
```

---

## 📝 Implementation Checklist

- [x] React SPA built in `rebuild/` folder
- [x] All 6 pages migrated (Landing, Streams, Watch, Multiwatch, History, Chat)
- [x] Zustand state management
- [x] WebSocket hooks with auto-reconnect
- [x] xterm.js Terminal component
- [x] Chat components with GIF picker
- [x] Theme toggle (dark/light)
- [x] Stream search & filtering
- [x] Mobile responsive layouts
- [x] Hot-swap mechanism in backend
- [x] Build pipeline integration
- [x] Documentation

---

## 🚦 Production Recommendation

**When to use Classic:**
- Established system
- No need for new features
- Minimal JavaScript footprint

**When to use React:**
- New features (search, filters, themes)
- Better mobile experience
- Easier to maintain and extend
- Modern developer experience

**Safest approach:**
1. Deploy with `USE_REACT_FRONTEND=false` (classic)
2. Test React locally with `USE_REACT_FRONTEND=true`
3. When confident, flip to React in production
4. Keep classic as instant rollback option

---

## 🎯 Summary

- ✅ **Complete React frontend** built in `rebuild/`
- ✅ **Zero backend changes** except hot-swap logic
- ✅ **All features preserved** + new enhancements
- ✅ **Toggle with env var** - no code changes
- ✅ **Instant rollback** if issues arise

**Toggle command:**
```bash
USE_REACT_FRONTEND=true npm start  # React
USE_REACT_FRONTEND=false npm start # Classic
```

That's it! 🎉
