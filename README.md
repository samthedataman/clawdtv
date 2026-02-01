# claude.tv 📺

Stream your Claude Code terminal sessions live. Friends watch and chat - all in the terminal. Like Twitch, but for coding.

## Quick Start

```bash
npx claude-tv
```

That's it! This opens the **home screen** where you can:
- Browse live streams
- Watch streams (up to 10 at once)
- Start your own stream
- Login/register

```
     ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗   ████████╗██╗   ██╗
    ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝   ╚══██╔══╝██║   ██║
    ██║     ██║     ███████║██║   ██║██║  ██║█████╗        ██║   ██║   ██║
    ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝        ██║   ╚██╗ ██╔╝
    ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗██╗   ██║    ╚████╔╝
     ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝     ╚═══╝

  🔴 3 LIVE  |  👥 47 viewers

  ┌─ Live Streams ──────────────────────┬─ Stream Info ─────────────┐
  │ 🥇 Building a CLI with Claude  @dan │                           │
  │ 🥈 React Native App            @sam │  Building a CLI with...   │
  │ 🥉 Debugging memory leak       @alex│  Broadcaster: dan         │
  │                                     │  Viewers: 23              │
  │                                     │  Uptime: 1h 23m           │
  └─────────────────────────────────────┴───────────────────────────┘

  Enter: Watch | S: Stream | R: Refresh | L: Login | Q: Quit
```

## Commands

| Command | Description |
|---------|-------------|
| `npx claude-tv` | Open home screen (stream browser) |
| `npx claude-tv register` | Create account |
| `npx claude-tv login` | Login |
| `npx claude-tv stream "title"` | Start streaming |
| `npx claude-tv watch <id>` | Watch a stream |
| `npx claude-tv watch <id1> <id2> ...` | Watch up to 10 streams |
| `npx claude-tv list` | List streams (non-interactive) |

## Home Screen Controls

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate streams |
| `Enter` | Watch selected stream |
| `S` | Start streaming |
| `R` | Refresh stream list |
| `L` | Login |
| `N` | Register new account |
| `Q` | Quit |

## Viewer Controls

| Key | Action |
|-----|--------|
| `Tab` | Switch focus (terminal/chat/input) |
| `1-9, 0` | Switch streams (when watching multiple) |
| `Page Up/Down` | Scroll |
| `Ctrl+C` | Quit |

## Chat Commands

```
/viewers     - List who's watching
/uptime      - Stream duration
/me <action> - Action message
```

**Mod commands:** `/ban`, `/mute`, `/unmute`, `/slow`, `/clear`, `/mod`, `/unmod`

---

## Deploy Your Own Server

### Render (Recommended - Free)

1. Fork/push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo (it auto-detects `render.yaml`)
4. Done! Update `src/shared/config.ts` with your URL

### Fly.io

```bash
fly launch && fly deploy
```

### Local + ngrok

```bash
node dist/index.js server  # Terminal 1
ngrok http 3000             # Terminal 2 - share this URL
```

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                    Server (Render/Fly.io)                    │
│            Auth • Rooms • Chat • Stream Relay                │
└──────────────────────────────────────────────────────────────┘
                    ▲                    ▲
         ┌──────────┴──────┐    ┌───────┴───────┐
         │    Streamer     │    │    Viewers    │
         │  npx claude-tv  │    │ npx claude-tv │
         │     stream      │    │    watch      │
         └────────┬────────┘    └───────┬───────┘
                  │                     │
                  ▼                     ▼
           Your terminal          Their terminals
          (captured live)        (stream + chat TUI)
```

Viewers see exactly what you see - full colors, cursor movement, everything. It's like screen sharing but entirely in the terminal.

## License

MIT
