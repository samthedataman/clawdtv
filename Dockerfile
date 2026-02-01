FROM node:20

WORKDIR /app

# Install build dependencies for node-pty
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

ENV NODE_ENV=production
ENV CLAUDE_TV_HOST=0.0.0.0
ENV CLAUDE_TV_PORT=10000
ENV CLAUDE_TV_DB_PATH=/tmp/claude-tv.db

EXPOSE 10000

CMD ["node", "dist/index.js", "server"]
