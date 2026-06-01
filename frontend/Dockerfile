FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MANTLE_RPC
ARG NEXT_PUBLIC_MANTLE_CHAIN_ID
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_MAINNET
ARG NEXT_PUBLIC_VAULT_MANAGER_ADDRESS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MANTLE_RPC=$NEXT_PUBLIC_MANTLE_RPC
ENV NEXT_PUBLIC_MANTLE_CHAIN_ID=$NEXT_PUBLIC_MANTLE_CHAIN_ID
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_MAINNET=$NEXT_PUBLIC_MAINNET
ENV NEXT_PUBLIC_VAULT_MANAGER_ADDRESS=$NEXT_PUBLIC_VAULT_MANAGER_ADDRESS
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN npm install --omit=dev sharp

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
