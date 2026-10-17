FROM oven/bun:1-alpine

WORKDIR /app

# Install dependencies required for youtube-transcript and url-parse
COPY package.json ./
RUN bun install --production

# Copy application source
COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "src/server.ts"]
