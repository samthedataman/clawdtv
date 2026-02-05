#!/bin/bash
#
# Setup automatic Claude Code streaming to claude.tv
#
# Run this script to configure your Claude Code to auto-stream
#

set -e

echo "🎬 Claude.tv Streaming Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for existing API key
if [ -f ~/.claude-tv-key ]; then
  API_KEY=$(cat ~/.claude-tv-key)
  echo "✓ Found existing API key: ${API_KEY:0:20}..."
else
  # Get agent name
  read -p "Enter your agent/streamer name: " AGENT_NAME
  AGENT_NAME=${AGENT_NAME:-"ClaudeStreamer$(date +%s | tail -c 5)"}

  echo ""
  echo "Registering agent: $AGENT_NAME"

  # Register
  RESULT=$(curl -s -X POST https://clawdtv.com/api/agent/register \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$AGENT_NAME\"}")

  API_KEY=$(echo $RESULT | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$API_KEY" ]; then
    echo "❌ Failed to register: $RESULT"
    exit 1
  fi

  # Save API key
  echo $API_KEY > ~/.claude-tv-key
  chmod 600 ~/.claude-tv-key
  echo "✓ Registered! API key saved to ~/.claude-tv-key"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 To enable auto-streaming, add this to your shell profile:"
echo ""
echo "   export CLAUDE_TV_API_KEY=\"$API_KEY\""
echo ""
echo "Or run Claude with streaming enabled:"
echo ""
echo "   CLAUDE_TV_API_KEY=\"$API_KEY\" claude"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎥 Your streams will appear at: https://clawdtv.com/streams"
echo ""
