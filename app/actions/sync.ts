"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  fetchPlaylistItems,
  fetchVideoDetails,
  parseDuration,
  getCategoryFromTopics,
  YOUTUBE_CATEGORY_MAP,
  hasYoutubeApiKey,
  fetchChannelVideosRss,
  fetchChannelVideosScrape,
} from "@/lib/youtube";

async function setChannelCategories(channelId: string, categoryNames: string[]) {
  const uniqueNames = [...new Set(categoryNames.filter(Boolean))];
  if (uniqueNames.length === 0) return;

  const categoryIds: string[] = [];
  for (const name of uniqueNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    categoryIds.push(cat.id);
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      categories: {
        set: categoryIds.map((id) => ({ id })),
      },
    },
  });
}

export async function syncChannelVideos(channelId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { maxVideosPerChannelSync: true, minVideoDurationSec: true },
  });
  const maxVideos = user?.maxVideosPerChannelSync ?? 500;
  const minDuration = user?.minVideoDurationSec ?? 300;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: true },
  });

  if (!channel?.uploadsPlaylistId) {
    throw new Error("Channel has no uploads playlist");
  }

  let videoDetails: Array<{
    id: string;
    title: string;
    description?: string;
    thumbnail?: string;
    durationSec: number | null;
    viewCount: number | null;
    likeCount: number | null;
    commentCount: number | null;
    youtubeTags: string | null;
    publishedAt: Date;
    category?: string;
  }> = [];

  if (hasYoutubeApiKey()) {
    // ── API path ──────────────────────────────────────────────────────
    const allItems: any[] = [];
    let pageToken: string | undefined;

    do {
      const data = await fetchPlaylistItems(channel.uploadsPlaylistId, pageToken);
      allItems.push(...(data.items || []));
      pageToken = data.nextPageToken;
    } while (pageToken && allItems.length < maxVideos);

    const videoIds = allItems.map((item: any) => item.snippet.resourceId.videoId).filter(Boolean);

    const apiDetails: any[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const data = await fetchVideoDetails(batch);
      apiDetails.push(...(data.items || []));
    }

    for (const v of apiDetails) {
      const durationSec = parseDuration(v.contentDetails?.duration || "");
      const catId = v.snippet?.categoryId ? parseInt(v.snippet.categoryId, 10) : undefined;
      const tags = v.snippet?.tags;
      videoDetails.push({
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
        durationSec,
        viewCount: v.statistics?.viewCount ? parseInt(v.statistics.viewCount, 10) : null,
        likeCount: v.statistics?.likeCount ? parseInt(v.statistics.likeCount, 10) : null,
        commentCount: v.statistics?.commentCount ? parseInt(v.statistics.commentCount, 10) : null,
        youtubeTags: Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null,
        publishedAt: new Date(v.snippet.publishedAt),
        category: catId ? YOUTUBE_CATEGORY_MAP[catId] : undefined,
      });
    }
  } else {
    // ── No-auth path: RSS + page scrape ───────────────────────────────
    let scraped: Array<{ id: string; title: string; description?: string; thumbnail?: string; viewCount?: number | null; publishedAt?: string }> = [];

    // Try RSS first (best data quality, ~15 videos)
    try {
      const rssVideos = await fetchChannelVideosRss(channelId);
      scraped.push(...rssVideos);
    } catch {
      // RSS failed, continue with page scrape
    }

    // Try page scrape for more videos (~30 videos)
    try {
      const pageVideos = await fetchChannelVideosScrape(channelId);
      // Merge: page scrape fills in videos RSS missed
      const existingIds = new Set(scraped.map((v) => v.id));
      for (const v of pageVideos) {
        if (!existingIds.has(v.id)) {
          scraped.push(v);
        }
      }
    } catch {
      // Page scrape failed
    }

    if (scraped.length === 0) {
      throw new Error(
        "Could not fetch channel videos. " +
          "Try adding a YouTube Data API key for reliable syncing."
      );
    }

    // Apply max videos limit
    if (scraped.length > maxVideos) {
      scraped = scraped.slice(0, maxVideos);
    }

    for (const v of scraped) {
      videoDetails.push({
        id: v.id,
        title: v.title,
        description: v.description,
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
        durationSec: null,
        viewCount: null,
        likeCount: null,
        commentCount: null,
        youtubeTags: null,
        publishedAt: v.publishedAt ? new Date(v.publishedAt) : new Date(),
        category: undefined,
      });
    }
  }

  const existingVideos = await prisma.video.findMany({
    where: { id: { in: videoDetails.map((v) => v.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existingVideos.map((v) => v.id));

  const categoryCounts = new Map<string, number>();
  const shortsToDelete: string[] = [];

  for (const v of videoDetails) {
    // Shorts filtering only works when we have duration
    if (v.durationSec !== null && v.durationSec > 0 && v.durationSec <= minDuration) {
      if (existingIds.has(v.id)) {
        shortsToDelete.push(v.id);
      }
      continue;
    }

    if (v.category) {
      categoryCounts.set(v.category, (categoryCounts.get(v.category) || 0) + 1);
    }

    const data = {
      id: v.id,
      title: v.title,
      description: v.description,
      thumbnail: v.thumbnail,
      durationSec: v.durationSec,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      youtubeTags: v.youtubeTags,
      publishedAt: v.publishedAt,
      channelId: channelId,
      category: v.category,
    };

    if (existingIds.has(v.id)) {
      await prisma.video.update({ where: { id: v.id }, data });
    } else {
      await prisma.video.create({ data });
    }
  }

  if (shortsToDelete.length > 0) {
    await prisma.video.deleteMany({
      where: { id: { in: shortsToDelete } },
    });
  }

  let mostCommonCategory: string | undefined;
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonCategory = cat;
    }
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: { lastSyncedAt: new Date() },
  });

  if (mostCommonCategory && channel.categories.length === 0) {
    await setChannelCategories(channelId, [mostCommonCategory]);
  }

  revalidatePath("/");
  revalidatePath("/channels/[channelId]");
  revalidatePath("/videos");
  revalidatePath("/settings");
}

export async function getChannelsNeedingSync(hoursAgo = 24) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const channels = await prisma.channel.findMany({
    where: {
      users: { some: { id: userId } },
      OR: [
        { lastSyncedAt: { lt: cutoff } },
        { lastSyncedAt: null },
      ],
    },
    select: { id: true, title: true, lastSyncedAt: true },
    orderBy: { lastSyncedAt: "asc" },
  });

  return channels;
}

export async function syncChannelsBatch(channelIds: string[]) {
  const results = [];
  for (const channelId of channelIds) {
    try {
      await syncChannelVideos(channelId);
      results.push({ channelId, status: "success" });
    } catch (e: any) {
      results.push({ channelId, status: "error", error: e.message });
    }
  }
  return results;
}
