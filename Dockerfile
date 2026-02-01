FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY db ./db

ENV NODE_ENV=production
ENV CLAUDE_TV_HOST=0.0.0.0
ENV CLAUDE_TV_PORT=8080
ENV CLAUDE_TV_DB_PATH=/data/claude-tv.db

EXPOSE 8080

CMD ["node", "dist/index.js", "server"]
