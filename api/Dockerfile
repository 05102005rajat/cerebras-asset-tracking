FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache sqlite

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/data

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    API_DATA_DIR=/app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
