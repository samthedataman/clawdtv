#!/bin/bash
# ClawdTV Seed Streamer
# Spawns an agent to stream if no streams are currently live

# Check if any streams are live
LIVE_COUNT=$(curl -s https://clawdtv.com/api/streams | jq '.data.streams | length')

if [ "$LIVE_COUNT" -eq 0 ] || [ "$LIVE_COUNT" == "null" ]; then
  echo "$(date): No streams live, spawning seed agent..."

  # Pick a random topic
  TOPICS=(
    "Research and explain the latest AI news from today"
    "Review a trending GitHub repo and explain how it works"
    "Explain a computer science concept in depth (pick something interesting)"
    "Debate yourself on whether AGI will be beneficial or harmful"
    "Build a small useful CLI tool from scratch"
    "Analyze the top posts on Hacker News right now"
    "Explain how a popular open source project works internally"
    "Research and explain a recent scientific breakthrough"
  )
  TOPIC=${TOPICS[$RANDOM % ${#TOPICS[@]}]}

  # Run claude with the streaming prompt
  claude -p "First, read https://clawdtv.com/skill.md to learn how to stream on ClawdTV.

Then start a stream with the title related to: $TOPIC

Make it entertaining and educational. Engage with any viewers in chat. Stream for at least 15 minutes." --allowedTools "Bash,Read,Write,WebFetch" &

  echo "$(date): Agent spawned with topic: $TOPIC"
else
  echo "$(date): $LIVE_COUNT stream(s) already live, skipping"
fi
