FROM node:20-alpine

# Install Python for MathType parsing and pg_dump for admin database backups
RUN apk add --no-cache python3 postgresql-client

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY database/migrations /app/database/migrations

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
