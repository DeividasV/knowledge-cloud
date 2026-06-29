---
name: prisma-user-video-state
description: Database patterns for per-user video watch status in knowledge-cloud. Use when querying videos by status, counting unwatched videos, updating watch state, or writing any Prisma query involving Video + UserVideo junction table. Covers the UNWATCHED-as-absence convention and bulk upsert patterns.
---

# Prisma UserVideo State Patterns

## Schema Overview

```prisma
model Video {
  id          String      @id
  title       String
  // ... metadata
  channelId   String
  channel     Channel     @relation(fields: [channelId], references: [id])
  userStates  UserVideo[]
}

model UserVideo {
  id          String   @id @default(cuid())
  userId      String
  videoId     String
  status      String   @default("UNWATCHED")  // "UNWATCHED" | "WATCHING" | "WATCHED" | "NOT_INTERESTED"
  progressSec Int      @default(0)
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  video       Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@unique([userId, videoId])
}
```

**Critical convention**: `UNWATCHED` means either:
1. No `UserVideo` row exists for this `(userId, videoId)` pair, OR
2. A `UserVideo` row exists with `status === "UNWATCHED"`

`WATCHED` and `NOT_INTERESTED` always require an existing `UserVideo` row.

**Active statuses**: `UNWATCHED`, `WATCHED`, `NOT_INTERESTED`. `WATCHING` is kept for backward compatibility but rarely used in the UI.

## Querying by Status

### UNWATCHED Videos

Use `NOT` with `userStates.some` to find videos with no state or explicit UNWATCHED:

```ts
const unwatchedVideos = await prisma.video.findMany({
  where: {
    channel: { users: { some: { id: userId } } },
    NOT: {
      userStates: {
        some: { userId, status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] } },
      },
    },
  },
  include: {
    channel: true,
    userStates: { where: { userId } },
  },
});
```

### WATCHING or WATCHED Videos

These are straightforward — require a matching `UserVideo` row:

```ts
const watchingVideos = await prisma.video.findMany({
  where: {
    channel: { users: { some: { id: userId } } },
    userStates: { some: { userId, status: "WATCHING" } },
  },
  include: {
    channel: true,
    userStates: { where: { userId } },
  },
});
```

### Counting by Status

```ts
// Count unwatched
const unwatchedCount = await prisma.video.count({
  where: {
    channelId,
    NOT: {
      userStates: {
        some: { userId, status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] } },
      },
    },
  },
});

// Count watched
const watchedCount = await prisma.video.count({
  where: {
    channelId,
    userStates: { some: { userId, status: "WATCHED" } },
  },
});
```

### Aggregating Statuses

Use `groupBy` for dashboard stats:

```ts
const statusCounts = await prisma.userVideo.groupBy({
  by: ["status"],
  where: { userId },
  _count: { status: true },
});

const counts = { UNWATCHED: 0, WATCHING: 0, WATCHED: 0, NOT_INTERESTED: 0 };
for (const s of statusCounts) {
  counts[s.status as keyof typeof counts] = s._count.status;
}
```

## Updating Status

### Single Video

Use `upsert` — creates row if missing, updates if exists:

```ts
await prisma.userVideo.upsert({
  where: { userId_videoId: { userId, videoId } },
  create: {
    userId,
    videoId,
    status: "WATCHED",
    progressSec: 0,
  },
  update: { status: "WATCHED", progressSec: 0 },
});
```

Always include `progressSec` (default 0) to satisfy schema requirements.

### Bulk Mark (All Channel Videos)

Use a transaction for atomicity:

```ts
const videos = await prisma.video.findMany({
  where: { channelId },
  select: { id: true },
});

const operations = videos.map((video) =>
  prisma.userVideo.upsert({
    where: { userId_videoId: { userId, videoId: video.id } },
    update: { status: "WATCHED", progressSec: 0 },
    create: {
      userId,
      videoId: video.id,
      status: "WATCHED",
      progressSec: 0,
    },
  })
);

await prisma.$transaction(operations);
```

## Reading Current Status

After fetching videos, derive the current status:

```ts
const currentStatus =
  (video.userStates[0]?.status as VideoStatus) || "UNWATCHED";
```

`userStates` is included in queries with `where: { userId }`, so it returns 0 or 1 items. If empty, the video is UNWATCHED.

## Search + Status Combined

When adding text search to status-filtered queries, merge the `where` clauses:

```ts
const where = {
  channel: { users: { some: { id: userId } } },
  title: { contains: query },
  // For UNWATCHED:
  NOT: { userStates: { some: { userId, status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] } } } },
  // For WATCHING/WATCHED:
  // userStates: { some: { userId, status: "WATCHING" } },
};
```

## Optimistic UI in VideoCard

`components/video-card.tsx` uses `useOptimistic` to update the status badge immediately while `updateVideoStatus` runs on the server, then calls `router.refresh()` to reconcile.

```ts
const [optimisticStatus, setOptimisticStatus] = useOptimistic(video.status);

const handleStatusChange = (status: VideoStatus) => {
  startTransition(async () => {
    setOptimisticStatus(status);
    await updateVideoStatus(video.id, status);
    router.refresh();
  });
};
```

## Revalidation

After any status mutation, revalidate affected paths:

```ts
revalidatePath("/");
revalidatePath("/videos");
revalidatePath("/channels/[channelId]");
```
