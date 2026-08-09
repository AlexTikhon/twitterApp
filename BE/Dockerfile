FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
RUN mkdir -p /app/images && chown node:node /app/images

USER node

EXPOSE 8080

CMD ["npm", "start"]
