FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npx esbuild worker/index.ts --bundle --platform=node --target=node20 --outfile=dist/worker/index.js --tsconfig=tsconfig.json --external:@prisma/client --external:.prisma/client --external:prisma

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/worker/index.js ./worker/index.js
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/africastalking ./node_modules/africastalking
COPY --from=builder /app/node_modules/openai ./node_modules/openai
COPY --from=builder /app/node_modules/groq-sdk ./node_modules/groq-sdk
CMD ["node", "worker/index.js"]
