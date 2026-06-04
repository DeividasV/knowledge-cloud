const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;

function apiKeyParam() {
  if (!API_KEY) throw new Error("YOUTUBE_API_KEY is not configured");
  return new URLSearchParams({ key: API_KEY });
}

// ── URL parsers ───────────────────────────────────────────────────────

const CHANNEL_URL_PATTERNS = [
  /youtube\.com\/@([^/?#]+)/,
  /youtube\.com\/c\/([^/?#]+)/,
  /youtube\.com\/channel\/([^/?#]+)/,
  /youtube\.com\/user\/([^/?#]+)/,
];

const VIDEO_URL_PATTERNS = [
  /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

export function extractChannelIdentifier(input: string): { type: "handle" | "id" | "username" | "custom"; value: string } | null {
  const trimmed = input.trim();

  // Raw channel ID (UC...)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    return { type: "id", value: trimmed };
  }

  // Raw @handle
  if (trimmed.startsWith("@")) {
    return { type: "handle", value: trimmed.slice(1) };
  }

  // URL patterns
  for (const pattern of CHANNEL_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const value = match[1];
      if (value.startsWith("UC")) return { type: "id", value };
      return { type: "handle", value };
    }
  }

  return null;
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Raw video ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // URL patterns
  for (const pattern of VIDEO_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// ── API calls (API key based) ─────────────────────────────────────────

export async function fetchChannelDetailsById(channelId: string) {
  const params = apiKeyParam();
  params.set("part", "snippet,contentDetails,statistics,topicDetails");
  params.set("id", channelId);
  params.set("maxResults", "1");

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    throw new Error(`Failed to fetch channel: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export async function fetchChannelDetailsByHandle(handle: string) {
  const params = apiKeyParam();
  params.set("part", "snippet,contentDetails,statistics,topicDetails");
  params.set("forHandle", handle.startsWith("@") ? handle : `@${handle}`);
  params.set("maxResults", "1");

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    throw new Error(`Failed to fetch channel by handle: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export async function resolveChannel(input: string) {
  const identifier = extractChannelIdentifier(input);
  if (!identifier) throw new Error("Invalid channel URL or identifier");

  if (identifier.type === "id") {
    return fetchChannelDetailsById(identifier.value);
  }
  return fetchChannelDetailsByHandle(identifier.value);
}

export async function fetchPlaylistItems(playlistId: string, pageToken?: string) {
  const params = apiKeyParam();
  params.set("part", "snippet");
  params.set("playlistId", playlistId);
  params.set("maxResults", "50");
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    throw new Error(`Failed to fetch playlist items: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export async function fetchVideoDetails(videoIds: string[]) {
  if (videoIds.length === 0) return { items: [] };

  const params = apiKeyParam();
  params.set("part", "snippet,contentDetails");
  params.set("id", videoIds.join(","));
  params.set("maxResults", "50");

  const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    throw new Error(`Failed to fetch video details: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export async function fetchVideoById(videoId: string) {
  const data = await fetchVideoDetails([videoId]);
  return data.items?.[0] ?? null;
}

// ── Utilities ─────────────────────────────────────────────────────────

export function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// YouTube video category IDs → names (static, rarely changes)
export const YOUTUBE_CATEGORY_MAP: Record<number, string> = {
  1: "Film & Animation",
  2: "Autos & Vehicles",
  10: "Music",
  15: "Pets & Animals",
  17: "Sports",
  19: "Travel & Events",
  20: "Gaming",
  22: "People & Blogs",
  23: "Comedy",
  24: "Entertainment",
  25: "News & Politics",
  26: "Howto & Style",
  27: "Education",
  28: "Science & Technology",
  29: "Nonprofits & Activism",
};

const TOPIC_TO_CATEGORY: Record<string, string> = {
  "/m/04rlf": "Music",
  "/m/02jjt": "Entertainment",
  "/m/019_rr": "Lifestyle",
  "/m/07c1v": "Technology",
  "/m/098wr": "Science",
  "/m/01k8wb": "Education",
  "/m/032tl": "Fashion",
  "/m/02wbm": "Food",
  "/m/03glg": "Hobbies",
  "/m/068hy": "Pets",
  "/m/041xxh": "Travel",
  "/m/07bxq": "Travel",
  "/m/04q1x3q": "Sports",
  "/m/06ntj": "Sports",
  "/m/0bzvm2": "Gaming",
  "/m/025zzc": "Gaming",
  "/m/0403l3g": "Gaming",
  "/m/0hvgt": "Gaming",
  "/m/01h6rj": "Motorsport",
  "/m/0204fg": "Aviation",
  "/m/09s1f": "Business",
  "/m/01sjng": "Finance",
  "/m/0404d": "Politics",
  "/m/01h404": "Health",
  "/m/0kt51": "Health",
  "/m/05qjc": "Arts",
  "/m/06cqb": "Education",
  "/m/0137_0": "Podcasts",
  "/m/0l14md": "Technology",
  "/m/07bs0": "Technology",
  "/m/0f2f9": "Entertainment",
  "/m/03_d0": "Entertainment",
  "/m/0h2r6": "Vehicles",
  "/m/08q1tg": "DIY",
};

export function getCategoryFromTopics(topicIds?: string[]): string | undefined {
  if (!topicIds || topicIds.length === 0) return undefined;
  for (const id of topicIds) {
    const cat = TOPIC_TO_CATEGORY[id];
    if (cat) return cat;
  }
  return undefined;
}
