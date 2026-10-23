# Build the whole workspace, then ship only the server bundle and the client assets.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# Install with the lockfile first so dependency layers cache across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/client
WORKDIR /app
# The server bundle is self-contained (engine, protocol and ws are bundled in).
COPY --from=build /app/packages/server/dist/index.js /app/server/index.js
COPY --from=build /app/packages/client/dist /app/client
EXPOSE 3000
USER node
CMD ["node", "/app/server/index.js"]
