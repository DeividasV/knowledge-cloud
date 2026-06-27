# YouTube Subscription Tracker

A personal dashboard to track your YouTube subscriptions and video watch progress.

## Features

- **Email/Password or Google OAuth Login** — Choose your sign-in method
- **Multi-User Ready** — Each user sees only their own channels, videos, and watch state
- **Subscription Sync** — Fetch all your subscribed channels via YouTube Data API
- **Video Tracking** — Sync recent uploads from each channel
- **Watch Status** — Mark videos as Unwatched, Watching, or Watched
- **Dashboard** — Overview stats, progress bar, recent videos
- **Channel Detail** — Browse videos per channel with filter tabs
- **Global Video List** — All videos with status filters
- **Settings** — Manual sync controls with quota awareness

## Tech Stack

- **Next.js 16** — App Router, React 19, TypeScript
- **Tailwind CSS + shadcn/ui** — Styling and components
- **Prisma 5 + PostgreSQL** — Database ORM
- **Auth.js (NextAuth v5)** — Google OAuth + email/password authentication
- **YouTube Data API v3** — Fetch subscriptions and videos

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in your `AUTH_SECRET`. Google OAuth is optional; fill in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` only if you want to keep Google sign-in.

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials (Web application)
3. Add authorized redirect URI: `http://localhost:44258/api/auth/callback/google`
4. Enable the **YouTube Data API v3** in your project
5. Copy Client ID and Client Secret to `.env`

#### YouTube Data API Key (required)

A YouTube Data API v3 key is required to sync channels and videos.

1. Enable **YouTube Data API v3** in [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
2. Create an API key and add it to `.env`:
   ```env
   YOUTUBE_API_KEY="your-api-key"
   ```

### 3. Start PostgreSQL (local development)

A Docker Compose file is provided for convenience:

```bash
docker compose up -d db
```

### 4. Initialize database

```bash
npx prisma migrate dev
npx prisma generate
```

If you are migrating from the previous SQLite setup, run the migration script after the database is initialized:

```bash
npx tsx scripts/migrate-sqlite-to-postgres.ts
```

### 5. Create a user

Self-registration is disabled. Create the first user from the command line:

```bash
npx tsx scripts/create-user.ts user@example.com strongpassword "User Name"
```

Run the same command to update a user's password later.

### 6. Run development server

```bash
npm run dev
```

Open [http://localhost:44258](http://localhost:44258) and sign in with your email and password (or Google, if configured).

### 7. Sync your data

After first login, go to **Settings** and click:
- **Sync Subscriptions** — pulls your subscribed channels
- **Sync All Videos** — fetches recent uploads from all channels

## Production Deployment

1. Set a strong `AUTH_SECRET`.
2. Set `AUTH_URL` to your public URL (e.g. `https://knowledge-cloud.example.com`).
3. Set `AUTH_TRUST_HOST="true"` if you run behind a reverse proxy.
4. Set `DATABASE_URL` to your PostgreSQL connection string.
5. Apply database migrations:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
6. Build and start:
   ```bash
   npm run build
   npm run start
   ```

## Important Notes

- **YouTube API Quota**: The default quota is ~10,000 units/day. Each sync consumes units based on your subscription count. Avoid excessive syncing.
- **Watch History Limitation**: YouTube's official API does **not** expose personal watch history. Watch status is tracked locally inside this app only.
- **PostgreSQL**: Requires a running PostgreSQL server. Use the provided `docker-compose.yml` for local development.

## License

MIT
