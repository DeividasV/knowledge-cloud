FROM node:22-alpine AS base
WORKDIR /app

# Install OpenSSL 1.1 compatibility required by Prisma 5 on Alpine/musl
RUN apk add --no-cache openssl1.1-compat

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
