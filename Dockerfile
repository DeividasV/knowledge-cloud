FROM node:22-slim AS base
WORKDIR /app

# Prisma 5 needs OpenSSL; curl is used for container healthchecks.
# postgresql-client provides pg_dump for the backup feature.
RUN apt-get update && apt-get install -y openssl curl postgresql-client && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy application source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js app
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
