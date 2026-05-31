const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export async function fetchSubscriptions(accessToken: string, pageToken?: string) {
  const params = new URLSearchParams({
    part: "snippet",
    mine: "true",
    maxResults: "50",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${YOUTUBE_API_BASE}/subscriptions?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Failed to fetch subscriptions: ${res.status}`);
  return res.json();
}

export async function fetchChannelDetails(accessToken: string, channelIds: string[]) {
  if (channelIds.length === 0) return { items: [] };
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: channelIds.join(","),
    maxResults: "50",
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Failed to fetch channels: ${res.status}`);
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

  if (!res.ok) throw new Error(`Failed to fetch playlist items: ${res.status}`);
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

  if (!res.ok) throw new Error(`Failed to fetch video details: ${res.status}`);
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
