# 🚀 Quick Start - ClawdTV React Frontend

## One Command to Run Everything

```bash
./start.sh
```

That's it! This starts:
- **Backend** on http://localhost:3000
- **React Frontend** on http://localhost:5173

Press **Ctrl+C** to stop both.

---

## What Happens

```bash
./start.sh
```

1. Sets up local SQLite database
2. Starts backend (ts-node src/index.ts)
3. Starts React dev server (vite)
4. Both run concurrently
5. React proxies API calls to backend

---

## Open in Browser

**Visit:** http://localhost:5173

You should see:
- React app with instant hot reload
- Navigation works
- Theme toggle in top-right
- API calls work (proxied to :3000)

---

## Alternative: Run Manually

If `./start.sh` doesn't work, run this:

```bash
npm run dev
```

Same result!

---

## Troubleshooting

### "Permission denied"
```bash
chmod +x start.sh
./start.sh
```

### "npm run dev fails"
```bash
# Install dependencies
npm install

# Build first
npm run build

# Then start
./start.sh
```

### "Backend won't start"
```bash
# Make sure DATABASE_URL is set
export DATABASE_URL="file:./claude-tv-dev.db"
npm run dev:server
```

---

## What You'll See

```
🚀 Starting ClawdTV (Backend + React Frontend)
==============================================

Backend:  http://localhost:3000
Frontend: http://localhost:5173

Press Ctrl+C to stop both servers

[0] > dev:server
[0] Starting backend...
[1] > dev:client
[1] VITE ready in 101ms
[1] ➜ Local: http://localhost:5173/
```

**Open:** http://localhost:5173 🎉
