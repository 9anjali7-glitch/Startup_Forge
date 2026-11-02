FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
COPY frontend/src/data/investors.json ./data/investors.json
COPY frontend/src/data/founders.json ./data/founders.json

EXPOSE 3000

CMD ["node", "server.js"]
