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
- **Prisma 5 + SQLite** — Database ORM
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

### 3. Initialize database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Create a user

Self-registration is disabled. Create the first user from the command line:

```bash
npx tsx scripts/create-user.ts user@example.com strongpassword "User Name"
```

Run the same command to update a user's password later.

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:44258](http://localhost:44258) and sign in with your email and password (or Google, if configured).

### 6. Sync your data

After first login, go to **Settings** and click:
- **Sync Subscriptions** — pulls your subscribed channels
- **Sync All Videos** — fetches recent uploads from all channels

## Production Deployment

1. Set a strong `AUTH_SECRET`.
2. Set `AUTH_URL` to your public URL (e.g. `https://knowledge-cloud.example.com`).
3. Set `AUTH_TRUST_HOST="true"` if you run behind a reverse proxy.
4. Switch from SQLite to PostgreSQL (or another server database) for multi-user hosting.
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
- **SQLite**: Uses a local `dev.db` file. Good for personal use. For multi-user deployment, switch to PostgreSQL.

## License

MIT
