FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine

RUN apk add --no-cache tini curl
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Default paths inside the container
ENV NODE_ENV=production \
    CLAW_OPS_PORT=8787 \
    CLAW_OPS_DB_PATH=/data/claw-ops.sqlite \
    CLAW_OPS_POLICIES_DIR=/policies \
    CLAW_OPS_RUNBOOKS_DIR=/runbooks \
    LOG_LEVEL=info

EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:8787/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "src/index.js"]
