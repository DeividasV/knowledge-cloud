# knowledge-cloud — Agent Guide

## Project Overview

YouTube Subscription Tracker — a personal dashboard web app built with Next.js, Prisma, and Auth.js.

## Technology Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Base UI components)
- **Database**: Prisma 5 + SQLite
- **Auth**: Auth.js (NextAuth v5) with Google OAuth + email/password credentials
- **API**: YouTube Data API v3

## Project Structure

```
app/
  (dashboard)/        # Authenticated routes with sidebar layout
    page.tsx          # Dashboard
    channels/         # Channel list & detail
    videos/           # Global video list
    settings/         # Sync controls
  login/              # Login page
  api/auth/           # Auth.js API route
lib/
  prisma.ts           # Singleton Prisma client
  auth.ts             # Auth.js config
  youtube.ts          # YouTube API helpers
  transcript.ts       # YouTube transcript fetcher
  types.ts            # Shared types (VideoStatus)
components/
  ui/                 # shadcn components
  sidebar.tsx
  mobile-nav.tsx
  video-status-toggle.tsx
  youtube-icon.tsx
```

## Database Schema

Key models:
- `User` — Auth.js managed user
- `Channel` — YouTube channel (linked to users via implicit m-n)
- `Video` — YouTube video metadata + transcript
- `UserVideo` — Watch status per user per video

## Build Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
```

## Notes for Agents

- The shadcn/ui setup uses **Base UI** (not Radix), so components like `Button` do **not** support `asChild`. Use `buttonVariants()` + `<Link>` instead.
- Prisma v5 is used (not v7) for stability. SQLite does not support enums — `VideoStatus` is a string type.
- Server Actions must return `void` when used as form actions.
- `revalidatePath` is used after mutations to refresh server components.
- Email/password users are created via `scripts/create-user.ts`; there is no self-registration UI.
