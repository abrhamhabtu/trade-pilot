# TradePilot Dockerfile (Next.js)
# Build and run the Next.js app from apps/web

FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/web/package*.json ./
RUN npm ci

COPY apps/web ./
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
