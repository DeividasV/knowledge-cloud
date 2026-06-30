# knowledge-cloud — Agent Guide

## Project Overview

YouTube Subscription Tracker — a personal dashboard web app built with Next.js, Prisma, and Auth.js.

## Technology Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 + shadcn/ui (Base UI components)
- **Database**: Prisma 5 + PostgreSQL
- **Auth**: Auth.js (NextAuth v5) with Google OAuth + email/password credentials
- **API**: YouTube Data API v3

## Project Structure

```
app/
  (dashboard)/        # Authenticated routes with sidebar layout
    page.tsx          # Dashboard with stats, tags, categories
    channels/         # Channel list & detail
    videos/           # Global video list with filters/search
    recommendations/  # Ranked recommendations (50 items + reason filters)
    tags/             # Tag graph and tag list
    settings/         # Sync controls and backup
    loading.tsx       # Route-level skeleton loading states
  login/              # Login page
  api/auth/           # Auth.js API route
lib/
  prisma.ts           # Singleton Prisma client
  auth.ts             # Auth.js config
  nav.ts              # Shared nav items for Sidebar + MobileNav
  youtube.ts          # YouTube API helpers + typed response shapes
  transcript.ts       # YouTube transcript fetcher
  types.ts            # Shared types (VideoStatus)
components/
  ui/                 # shadcn/ui Base UI components
  sidebar.tsx         # Desktop nav + sticky category filter
  mobile-nav.tsx      # Mobile header + sheet nav
  command-palette.tsx # Cmd/Ctrl+K search navigation
  video-card.tsx      # Thumbnail card with status badge + quick actions
  video-status-toggle.tsx
  youtube-icon.tsx
```

## Database Schema

Key models:
- `User` — Auth.js managed user, also tracks `lastVisitAt` for "new" video badges
- `Channel` — YouTube channel (linked to users via implicit m-n)
- `Video` — YouTube video metadata + transcript
- `UserVideo` — Watch status and `progressSec` per user per video

## Build Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
```

## Notes for Agents

- The shadcn/ui setup uses **Base UI** (not Radix), so components like `Button` do **not** support `asChild`. Use `buttonVariants()` + `<Link>` instead.
- Prisma v5 is used (not v7) for stability. `VideoStatus` is kept as a string type for compatibility.
- Server Actions must return `void` when used as form actions.
- `revalidatePath` is used after mutations to refresh server components.
- Email/password users are created via `scripts/create-user.ts`; there is no self-registration UI.
- Navigation items live in `lib/nav.ts` and are consumed by both `Sidebar` and `MobileNav`.
- Images use `next/image`. External domains (`i.ytimg.com`, `yt3.ggpht.com`, `*.googleusercontent.com`) are configured in `next.config.ts`.
- Route-level skeleton screens live in `app/(dashboard)/**/loading.tsx`.
- `npm run lint -- --max-warnings=0` and `npx tsc --noEmit` must pass before merging.
