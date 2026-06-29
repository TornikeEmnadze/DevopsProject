FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache --upgrade libcrypto3 libssl3 \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -rf /usr/local/lib/node_modules/corepack \
  && rm -rf /opt/yarn-v* \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p /home/node/app-logs \
  && chown -R node:node /home/node/app-logs /app

USER node

ENV HOST=0.0.0.0
ENV PORT=3000
ENV APP_LOG_FILE=/home/node/app-logs/app.log

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/container-healthcheck.js

CMD ["node", "src/index.js"]
