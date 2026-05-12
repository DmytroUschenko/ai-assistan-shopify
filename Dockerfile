# Stage 1: fe-builder
FROM node:20-alpine AS fe-builder
WORKDIR /build/frontend
RUN apk add --no-cache openssl
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/prisma ./prisma
RUN ./node_modules/.bin/prisma generate
COPY frontend/ .
RUN npm run build

# Stage 2: be-builder
FROM node:20-alpine AS be-builder
WORKDIR /build/backend
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig*.json backend/nest-cli.json ./
COPY backend/src ./src
RUN npm run build

# Stage 3: production
FROM node:20-alpine AS production
RUN apk add --no-cache openssl ca-certificates supervisor
WORKDIR /app

# FE
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY --from=fe-builder /build/frontend/build ./build
COPY --from=fe-builder /build/frontend/public/build ./public/build
COPY --from=fe-builder /build/frontend/node_modules/.prisma ./node_modules/.prisma
COPY --from=fe-builder /build/frontend/node_modules/@prisma ./node_modules/@prisma
COPY --from=fe-builder /build/frontend/node_modules/prisma ./node_modules/prisma
COPY --from=fe-builder /build/frontend/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY frontend/prisma ./prisma
COPY frontend/server.js ./
COPY frontend/shopify.app.prod.toml ./shopify.app.toml
RUN mkdir -p data public

# BE
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=be-builder /build/backend/dist ./dist

WORKDIR /app
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 3000
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
