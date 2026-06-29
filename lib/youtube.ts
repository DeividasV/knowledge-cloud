const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;

function apiKeyParam() {
  if (!API_KEY) throw new Error("YOUTUBE_API_KEY is not configured");
  return new URLSearchParams({ key: API_KEY });
}

export function hasYoutubeApiKey(): boolean {
  return !!API_KEY;
}

// ── Shared API response shapes ────────────────────────────────────────

export interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface YouTubeThumbnails {
  default?: YouTubeThumbnail;
  medium?: YouTubeThumbnail;
  high?: YouTubeThumbnail;
}

export interface YouTubeApiListResponse<T> {
  items?: T[];
  nextPageToken?: string;
}

// ── Channel shapes ────────────────────────────────────────────────────

export interface YouTubeChannelSnippet {
  title: string;
  description?: string;
  thumbnails?: YouTubeThumbnails;
}

export interface YouTubeChannelContentDetails {
  relatedPlaylists?: {
    uploads?: string | null;
  };
}

export interface YouTubeChannelStatistics {
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
}

export interface YouTubeChannelTopicDetails {
  topicIds?: string[];
}

export interface YouTubeChannel {
  id: string;
  snippet: YouTubeChannelSnippet;
  contentDetails?: YouTubeChannelContentDetails;
  statistics?: YouTubeChannelStatistics;
  topicDetails?: YouTubeChannelTopicDetails;
}

// ── Video shapes ──────────────────────────────────────────────────────

export interface YouTubeVideoSnippet {
  title: string;
  description?: string;
  publishedAt: string;
  thumbnails?: YouTubeThumbnails;
  channelId?: string | null;
  channelTitle?: string;
  categoryId?: string;
  tags?: string[];
}

export interface YouTubeVideoContentDetails {
  duration?: string;
}

export interface YouTubeVideoStatistics {
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
}

export interface YouTubeVideo {
  id: string;
  snippet: YouTubeVideoSnippet;
  contentDetails?: YouTubeVideoContentDetails;
  statistics?: YouTubeVideoStatistics;
}

// ── Playlist item shapes ──────────────────────────────────────────────

export interface YouTubePlaylistItemSnippet {
  resourceId?: {
    videoId?: string;
  };
  title?: string;
  description?: string;
  thumbnails?: YouTubeThumbnails;
  publishedAt?: string;
}

export interface YouTubePlaylistItem {
  id: string;
  snippet: YouTubePlaylistItemSnippet;
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

export async function fetchChannelDetailsById(channelId: string): Promise<YouTubeApiListResponse<YouTubeChannel>> {
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

export async function fetchChannelDetailsByHandle(handle: string): Promise<YouTubeApiListResponse<YouTubeChannel>> {
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

export async function resolveChannel(input: string): Promise<YouTubeApiListResponse<YouTubeChannel>> {
  const identifier = extractChannelIdentifier(input);
  if (!identifier) throw new Error("Invalid channel URL or identifier");

  if (identifier.type === "id") {
    return fetchChannelDetailsById(identifier.value);
  }
  return fetchChannelDetailsByHandle(identifier.value);
}

// ── Fallback: scrape YouTube channel page (no API key) ─────────────────

async function scrapeChannelPage(url: string): Promise<YouTubeApiListResponse<YouTubeChannel>> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch channel page: ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/var ytInitialData = ({.+?});<\/script>/);
  if (!match) {
    throw new Error("Could not parse channel page metadata");
  }

  const data = JSON.parse(match[1]);
  const meta = data.metadata?.channelMetadataRenderer;
  if (!meta) {
    throw new Error("Channel metadata not found on page");
  }

  const channelId = meta.externalId as string;
  const thumbnails = meta.avatar?.thumbnails || [];
  const thumbnail = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;

  // Derive uploads playlist ID from channel ID (UC... → UU...)
  const uploadsPlaylistId = channelId.startsWith("UC")
    ? "UU" + channelId.slice(2)
    : null;

  return {
    items: [{
      id: channelId,
      snippet: {
        title: meta.title || "Unknown channel",
        thumbnails: {
          medium: { url: thumbnail },
          default: { url: thumbnail },
        },
      },
      contentDetails: {
        relatedPlaylists: {
          uploads: uploadsPlaylistId,
        },
      },
      statistics: {
        subscriberCount: undefined,
        videoCount: undefined,
      },
      topicDetails: {
        topicIds: [],
      },
    }],
  };
}

export async function resolveChannelFallback(input: string): Promise<YouTubeApiListResponse<YouTubeChannel>> {
  const identifier = extractChannelIdentifier(input);
  if (!identifier) throw new Error("Invalid channel URL or identifier");

  let pageUrl: string;
  if (identifier.type === "id") {
    pageUrl = `https://www.youtube.com/channel/${identifier.value}`;
  } else {
    pageUrl = `https://www.youtube.com/@${identifier.value}`;
  }

  return scrapeChannelPage(pageUrl);
}

export async function fetchPlaylistItems(playlistId: string, pageToken?: string): Promise<YouTubeApiListResponse<YouTubePlaylistItem>> {
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

export async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeApiListResponse<YouTubeVideo>> {
  if (videoIds.length === 0) return { items: [] };

  const params = apiKeyParam();
  params.set("part", "snippet,contentDetails,statistics");
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

export async function fetchVideoById(videoId: string): Promise<YouTubeVideo | null> {
  const data = await fetchVideoDetails([videoId]);
  return data.items?.[0] ?? null;
}

/**
 * Fallback video metadata fetcher using noembed (no API key required).
 * Returns data shaped like the YouTube Data API response.
 */
export async function fetchVideoByIdFallback(videoId: string): Promise<YouTubeVideo> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`noembed fetch failed: ${res.status}`);
  }

  // noembed returns an ad-hoc JSON object; treat it as unknown and narrow the fields we need.
  const data = (await res.json()) as Record<string, unknown>;

  // Try to extract channel identifier from author_url
  let channelId: string | null = null;
  const authorUrl = typeof data.author_url === "string" ? data.author_url : "";
  const channelMatch = authorUrl.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (channelMatch) {
    channelId = channelMatch[1];
  }

  const thumbnailUrl = typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;

  return {
    id: videoId,
    snippet: {
      title: typeof data.title === "string" ? data.title : "Unknown title",
      description: "",
      thumbnails: {
        medium: { url: thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
        default: { url: thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/default.jpg` },
      },
      publishedAt: new Date().toISOString(),
      channelId,
      channelTitle: typeof data.author_name === "string" ? data.author_name : "Unknown channel",
      categoryId: undefined,
    },
    contentDetails: {
      duration: "",
    },
  };
}

// ── No-auth channel video fetchers ────────────────────────────────────

interface ScrapedVideo {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  publishedAt?: string;
}

export async function fetchChannelVideosRss(channelId: string): Promise<ScrapedVideo[]> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(rssUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status}`);
  }

  const xml = await res.text();
  const videos: ScrapedVideo[] = [];

  // Parse entries with regex (simple and reliable for RSS)
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const thumbMatch = entry.match(/<media:thumbnail url="([^"]+)"/);
    const descMatch = entry.match(/<media:description>([\s\S]*?)<\/media:description>/);

    if (idMatch && titleMatch) {
      videos.push({
        id: idMatch[1],
        title: titleMatch[1],
        publishedAt: publishedMatch ? publishedMatch[1] : undefined,
        thumbnail: thumbMatch ? thumbMatch[1] : undefined,
        description: descMatch ? descMatch[1] : undefined,
      });
    }
  }

  return videos;
}

export async function fetchChannelVideosScrape(channelId: string): Promise<ScrapedVideo[]> {
  const pageUrl = `https://www.youtube.com/channel/${channelId}/videos`;
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": "CONSENT=YES+cb",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Page scrape failed: ${res.status}`);
  }

  const html = await res.text();
  const scriptMatch = html.match(/var ytInitialData = ({.+?});<\/script>/);
  if (!scriptMatch) {
    throw new Error("Could not find ytInitialData on channel page");
  }

  const data = JSON.parse(scriptMatch[1]);
  const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  const videos: ScrapedVideo[] = [];

  for (const tab of tabs) {
    const tr = tab.tabRenderer;
    if (!tr?.selected) continue;

    const items = tr.content?.richGridRenderer?.contents || [];
    for (const item of items) {
      const lockup = item.richItemRenderer?.content?.lockupViewModel;
      if (!lockup) continue;

      // Extract video ID from thumbnail URL
      const sources = lockup.contentImage?.thumbnailViewModel?.image?.sources || [];
      let videoId: string | null = null;
      for (const src of sources) {
        const vidMatch = src.url?.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
        if (vidMatch) {
          videoId = vidMatch[1];
          break;
        }
      }

      // Extract title
      const title = lockup.metadata?.lockupMetadataViewModel?.title?.content;

      if (videoId && title) {
        videos.push({
          id: videoId,
          title,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        });
      }
    }
  }

  return videos;
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
