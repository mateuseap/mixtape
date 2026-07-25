FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile
COPY client ./client
COPY server ./server
RUN pnpm --filter client build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./server/public
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "server/src/server.js"]
