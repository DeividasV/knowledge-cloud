# YouTube Subscription Tracker

A personal dashboard to track your YouTube subscriptions and video watch progress.

## Features

- **Google OAuth Login** — Connect your YouTube account securely
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
- **Auth.js (NextAuth v5)** — Google OAuth authentication
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

Fill in your `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`.

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials (Web application)
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Enable the **YouTube Data API v3** in your project
5. Copy Client ID and Client Secret to `.env`

### 3. Initialize database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

### 5. Sync your data

After first login, go to **Settings** and click:
- **Sync Subscriptions** — pulls your subscribed channels
- **Sync All Videos** — fetches recent uploads from all channels

## Important Notes

- **YouTube API Quota**: The default quota is ~10,000 units/day. Each sync consumes units based on your subscription count. Avoid excessive syncing.
- **Watch History Limitation**: YouTube's official API does **not** expose personal watch history. Watch status is tracked locally inside this app only.
- **SQLite**: Uses a local `dev.db` file. Good for personal use. For multi-user deployment, switch to PostgreSQL.

## License

MIT
