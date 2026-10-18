FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir /app/data && chown node:node /app/data
USER node
CMD ["node", "src/index.js"]
