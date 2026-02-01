FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies
RUN npm prune --production

ENV NODE_ENV=production
ENV CLAUDE_TV_HOST=0.0.0.0
ENV CLAUDE_TV_PORT=10000
ENV CLAUDE_TV_DB_PATH=/tmp/claude-tv.db

EXPOSE 10000

CMD ["node", "dist/index.js", "server"]
