FROM node:24.17.0-alpine3.23

WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /app/images && chown node:node /app/images

USER node

EXPOSE 8080

CMD ["node", "app.js"]
