FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

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
