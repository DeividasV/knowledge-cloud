---
name: youtube-api-patterns
description: YouTube Data API v3 integration patterns for knowledge-cloud. Use when working with API-key based fetching, batched channel/video requests, playlist item sync, quota management, or error handling. Covers lib/youtube.ts wrappers and app/actions/sync.ts batch strategies.
---

# YouTube API Patterns

The app uses an API-key based integration with YouTube Data API v3. Set `YOUTUBE_API_KEY` in `.env`.

## API Wrapper Patterns

`lib/youtube.ts` provides typed wrappers around YouTube Data API v3:

```ts
import {
  fetchSubscriptions,
  fetchChannelDetails,
  fetchPlaylistItems,
  fetchVideoDetails,
  parseDuration,
  type YouTubeChannel,
  type YouTubeVideo,
  type YouTubePlaylistItem,
} from "@/lib/youtube";
```

All endpoints:
- Use `process.env.YOUTUBE_API_KEY`
- Return typed JSON responses
- Log requests and errors with `[YouTube API]` prefix
- Use `next: { revalidate: 0 }` to disable fetch caching

### Endpoints

```ts
// Fetch channel details (batched, comma-separated IDs)
const data = await fetchChannelDetails(["UC...", "UC..."]);
// Returns: YouTubeApiListResponse<YouTubeChannel>
// Max 50 IDs per call

// Fetch upload playlist items (paginated)
const data = await fetchPlaylistItems(playlistId, pageToken);
// Returns: YouTubeApiListResponse<YouTubePlaylistItem>

// Fetch video details (batched, comma-separated IDs)
const data = await fetchVideoDetails(["dQw4w9WgXcQ", ...]);
// Returns: YouTubeApiListResponse<YouTubeVideo>
// Max 50 IDs per call
```

### Duration Parsing

```ts
import { parseDuration } from "@/lib/youtube";
const seconds = parseDuration("PT1H30M15S"); // 5415
```

## Batched Fetching Strategy

### Channel Details

Batch by 50 IDs (API limit):

```ts
for (let i = 0; i < channelIds.length; i += 50) {
  const batch = channelIds.slice(i, i + 50);
  const data = await fetchChannelDetails(batch);
  // process data.items
}
```

### Video Details

Same 50-item batch pattern after extracting video IDs from playlist items:

```ts
for (let i = 0; i < videoIds.length; i += 50) {
  const batch = videoIds.slice(i, i + 50);
  const data = await fetchVideoDetails(batch);
  // process data.items
}
```

### Playlist Items

Paginate and cap per channel to manage quota:

```ts
let pageToken: string | undefined;
const allItems: YouTubePlaylistItem[] = [];
do {
  const data = await fetchPlaylistItems(uploadsPlaylistId, pageToken);
  allItems.push(...(data.items || []));
  pageToken = data.nextPageToken;
} while (pageToken && allItems.length < 200);
```

## Sync Quota Management

Daily quota: ~10,000 units. Sync actions limit fetching to avoid exhaustion:

| Action | Limit | Why |
|--------|-------|-----|
| `syncChannelVideos` | 200 videos/channel | Quota + storage |
| `syncAllChannelsVideos` | 5 channels/batch | Avoid serverless timeout |

## Upsert Pattern

After fetching, upsert into Prisma to avoid duplicates:

```ts
const existing = await prisma.video.findMany({
  where: { id: { in: videoIds } },
  select: { id: true },
});
const existingIds = new Set(existing.map((v) => v.id));

for (const v of videoDetails) {
  const data = { id: v.id, title: v.snippet.title, /* ... */ };
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
