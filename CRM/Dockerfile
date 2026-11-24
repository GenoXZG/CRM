FROM node:22.20.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.browser.json ./
COPY src ./src
COPY scripts/build.js ./scripts/build.js
RUN npm run typecheck && npm run build

FROM node:22.20.0-bookworm-slim AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public/assets ./public/assets
COPY --chown=node:node scripts/migrate.js ./scripts/migrate.js
COPY --chown=node:node docker/mysql/migrations ./docker/mysql/migrations
COPY --chown=node:node views ./views
COPY --chown=node:node public/css ./public/css
COPY --chown=node:node public/js ./public/js
RUN mkdir -p evidence/validated evidence/tickets && chown -R node:node evidence
USER node
ENV NODE_ENV=production PORT=3030
EXPOSE 3030
CMD ["node", "dist/server.js"]
