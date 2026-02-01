# Claude Code Integration

## Option 1: Stream Your Session

Run claude-tv in the same terminal before starting Claude Code:

```bash
# First time: register
npx claude-tv register

# Start streaming, then use Claude Code normally
npx claude-tv stream "Building a web app with Claude"
# Everything you do with Claude Code is now streamed!
```

## Option 2: Quick Alias

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Stream and code with Claude
alias claude-stream='npx claude-tv stream "Claude Code Session" &'
```

Then just run:
```bash
claude-stream
claude  # Start Claude Code - your session is now live!
```

## Option 3: tmux/screen setup

For the best experience, use tmux:

```bash
# Start tmux
tmux new-session -s claude

# Split and stream in one pane
tmux split-window -h 'npx claude-tv stream "My Session"'

# Use Claude Code in the main pane
claude
```

## Watching Streams

Anyone can watch your stream:

```bash
# List active streams
npx claude-tv list

# Watch a stream
npx claude-tv watch <room-id>
```

## Chat Commands

While watching:
- Type messages to chat with the streamer
- `/viewers` - See who's watching
- `/uptime` - See how long the stream has been live
