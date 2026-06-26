---
name: youtube-api-patterns
description: YouTube Data API v3 integration patterns for knowledge-cloud. Use when working with OAuth token refresh, batched API fetching, playlist/video sync, quota management, or YouTube API error handling. Covers lib/youtube.ts wrappers, lib/token.ts refresh flow, and app/actions/sync.ts batch strategies.
---

# YouTube API Patterns

## Token Refresh Flow

`lib/token.ts` manages Google OAuth token refresh automatically. Use `getValidAccessToken(userId)` in every server action that calls YouTube APIs.

```ts
import { getValidAccessToken } from "@/lib/token";

const token = await getValidAccessToken(userId);
// token is guaranteed fresh (refreshed if within 60s of expiry)
```

The refresh flow:
1. Check `account.expires_at` against current time + 60s buffer
2. If expired, call `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`
3. Update DB `account` row with new `access_token` and `expires_at`
4. Return fresh token

**Never** use `account.access_token` directly — always go through `getValidAccessToken()`.

## API Wrapper Patterns

`lib/youtube.ts` provides thin wrappers around YouTube Data API v3. All endpoints:
- Accept a fresh OAuth `accessToken` (not a server key)
- Return raw JSON (caller handles pagination)
- Log requests and errors with `[YouTube API]` prefix
- Use `next: { revalidate: 0 }` to disable fetch caching

### Endpoints

```ts
// Fetch user's subscriptions (paginated)
const data = await fetchSubscriptions(token, pageToken);
// Returns: { items: [...], nextPageToken?: string }

// Fetch channel details (batched, comma-separated IDs)
const data = await fetchChannelDetails(token, ["UC...", "UC..."]);
// Max 50 IDs per call

// Fetch upload playlist items (paginated)
const data = await fetchPlaylistItems(token, playlistId, pageToken);

// Fetch video details (batched, comma-separated IDs)
const data = await fetchVideoDetails(token, ["dQw4w9WgXcQ", ...]);
// Max 50 IDs per call
```

### Duration Parsing

```ts
import { parseDuration } from "@/lib/youtube";
const seconds = parseDuration("PT1H30M15S"); // 5415
```

## Batched Fetching Strategy

### Subscriptions

Paginate through all subscription pages (no limit — user has ~222 channels):

```ts
const allSubs: any[] = [];
let pageToken: string | undefined;
do {
  const data = await fetchSubscriptions(token, pageToken);
  allSubs.push(...(data.items || []));
  pageToken = data.nextPageToken;
} while (pageToken);
```

### Channel Details

Batch by 50 IDs (API limit):

```ts
for (let i = 0; i < channelIds.length; i += 50) {
  const batch = channelIds.slice(i, i + 50);
  const data = await fetchChannelDetails(token, batch);
  // process data.items
}
```

### Video Details

Same 50-item batch pattern after extracting video IDs from playlist items.

## Sync Quota Management

Daily quota: ~10,000 units. Sync actions limit fetching to avoid exhaustion:

| Action | Limit | Why |
|--------|-------|-----|
| `syncChannelVideos` | 200 videos/channel | Quota + storage |
| `syncAllChannelsVideos` | 5 channels/batch | Avoid serverless timeout |

### Per-Channel Sync

```ts
// In syncChannelVideos — cap at 200 videos
 do {
  const data = await fetchPlaylistItems(token, playlistId, pageToken);
  allItems.push(...(data.items || []));
  pageToken = data.nextPageToken;
} while (pageToken && allItems.length < 200);
```

### Batch Sync

```ts
// In syncAllChannelsVideos — process in batches of 5
for (let i = 0; i < channels.length; i += 5) {
  const batch = channels.slice(i, i + 5);
  await syncChannelsBatch(batch.map(c => c.id));
}
```

## Upsert Pattern

After fetching, upsert into Prisma to avoid duplicates:

```ts
// Check existing IDs first (single query)
const existing = await prisma.video.findMany({
  where: { id: { in: videoIds } },
  select: { id: true },
});
const existingIds = new Set(existing.map(v => v.id));

// Insert new and update existing rows
for (const v of videoDetails) {
  const data = { id: v.id, title: v.snippet.title, ... };
  if (existingIds.has(v.id)) {
    await prisma.video.update({ where: { id: v.id }, data });
  } else {
    await prisma.video.create({ data });
  }
}
```

## Error Handling

All wrappers throw on non-2xx with full error body logged:

```ts
if (!res.ok) {
  const errorBody = await res.text().catch(() => "unknown");
  console.error("[YouTube API] fetchX failed:", res.status, errorBody);
  throw new Error(`Failed to fetch X: ${res.status} — ${errorBody}`);
}
```

Caller should catch and surface to user (e.g., in `syncChannelsBatch`).
