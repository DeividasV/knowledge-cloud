const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// Map YouTube topic IDs to human-readable categories
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

export async function fetchSubscriptions(accessToken: string, pageToken?: string) {
  const params = new URLSearchParams({
    part: "snippet",
    mine: "true",
    maxResults: "50",
  });
  if (pageToken) params.set("pageToken", pageToken);

  console.log("[YouTube API] fetchSubscriptions with token:", accessToken.substring(0, 20) + "...");

  const res = await fetch(`${YOUTUBE_API_BASE}/subscriptions?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    console.error("[YouTube API] fetchSubscriptions failed:", res.status, errorBody);
    throw new Error(`Failed to fetch subscriptions: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export async function fetchChannelDetails(accessToken: string, channelIds: string[]) {
  if (channelIds.length === 0) return { items: [] };
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics,topicDetails",
    id: channelIds.join(","),
    maxResults: "50",
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    console.error("[YouTube API] fetchChannelDetails failed:", res.status, errorBody);
    throw new Error(`Failed to fetch channels: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export async function fetchPlaylistItems(accessToken: string, playlistId: string, pageToken?: string) {
  const params = new URLSearchParams({
    part: "snippet",
    playlistId,
    maxResults: "50",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    console.error("[YouTube API] fetchPlaylistItems failed:", res.status, errorBody);
    throw new Error(`Failed to fetch playlist items: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export async function fetchVideoDetails(accessToken: string, videoIds: string[]) {
  if (videoIds.length === 0) return { items: [] };
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: videoIds.join(","),
    maxResults: "50",
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unknown");
    console.error("[YouTube API] fetchVideoDetails failed:", res.status, errorBody);
    throw new Error(`Failed to fetch video details: ${res.status} — ${errorBody}`);
  }
  return res.json();
}

export function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}
