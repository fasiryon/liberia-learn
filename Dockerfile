FROM node:20-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY scripts/patch-vitest-offline-wildcard.mjs ./scripts/patch-vitest-offline-wildcard.mjs
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXTAUTH_URL
ARG SENTRY_ORG
ARG SENTRY_PROJECT

ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Database/auth credentials belong to the running container, never build args.
# Source-map upload is optional and receives its token only for this instruction.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    if [ -f /run/secrets/SENTRY_AUTH_TOKEN ]; then \
      export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)"; \
    fi; \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:20-alpine AS worker-builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npx esbuild worker/index.ts --bundle --platform=node --target=node20 --outfile=dist/worker/index.js --tsconfig=tsconfig.json --external:@prisma/client --external:.prisma/client --external:prisma

FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=worker-builder /app/node_modules ./node_modules
COPY --from=worker-builder /app/dist/worker/index.js ./worker/index.js
COPY --from=worker-builder /app/prisma ./prisma
COPY --from=worker-builder /app/package.json ./package.json
CMD ["node", "worker/index.js"]
