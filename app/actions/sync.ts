"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertUserOwnsChannel } from "@/lib/video-access";
import {
  fetchPlaylistItems,
  fetchVideoDetails,
  parseDuration,
  YOUTUBE_CATEGORY_MAP,
  hasYoutubeApiKey,
  type YouTubePlaylistItem,
  type YouTubeVideo,
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

async function propagateChannelCategoryToVideos(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: { orderBy: { name: "asc" } } },
  });
  if (!channel || channel.categories.length === 0) return;

  const primaryCategory = channel.categories[0].name;
  await prisma.video.updateMany({
    where: { channelId },
    data: { category: primaryCategory },
  });
}

export async function syncChannelVideosInternal(
  channelId: string,
  maxVideos: number,
  minDuration: number
) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: true },
  });

  if (!channel?.uploadsPlaylistId) {
    throw new Error("Channel has no uploads playlist");
  }

  const videoDetails: Array<{
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
    // Fetch the entire uploads playlist first, then apply the duration filter
    // and the max-videos cap. Stopping early at maxVideos raw playlist items
    // skips long videos that appear after many shorts in the playlist.
    const allItems: YouTubePlaylistItem[] = [];
    let pageToken: string | undefined;

    do {
      const data = await fetchPlaylistItems(channel.uploadsPlaylistId, pageToken);
      allItems.push(...(data.items || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    const videoIds = allItems
      .map((item) => item.snippet.resourceId?.videoId)
      .filter((id): id is string => Boolean(id));

    const apiDetails: YouTubeVideo[] = [];
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
    throw new Error(
      "YouTube Data API key is not configured. " +
        "Add YOUTUBE_API_KEY to your .env file to sync channels."
    );
  }

  const existingVideos = await prisma.video.findMany({
    where: { id: { in: videoDetails.map((v) => v.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existingVideos.map((v) => v.id));

  const categoryCounts = new Map<string, number>();
  const shortsToDelete: string[] = [];
  let storedCount = 0;

  for (const v of videoDetails) {
    // Shorts filtering only works when we have duration
    if (v.durationSec !== null && v.durationSec > 0 && v.durationSec <= minDuration) {
      if (existingIds.has(v.id)) {
        shortsToDelete.push(v.id);
      }
      continue;
    }

    if (storedCount >= maxVideos) {
      continue;
    }
    storedCount++;

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

  // Propagate channel categories to all its videos so standalone-like filtering works
  await propagateChannelCategoryToVideos(channelId);
}

export async function syncChannelVideos(channelId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  await assertUserOwnsChannel(userId, channelId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { maxVideosPerChannelSync: true, minVideoDurationSec: true },
  });
  const maxVideos = user?.maxVideosPerChannelSync ?? 500;
  const minDuration = user?.minVideoDurationSec ?? 300;

  await syncChannelVideosInternal(channelId, maxVideos, minDuration);

  revalidatePath("/");
  revalidatePath("/channels/[channelId]");
  revalidatePath("/videos");
  revalidatePath("/settings");
}

export async function getChannelsNeedingSyncForUser(userId: string, hoursAgo = 24) {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  return prisma.channel.findMany({
    where: {
      users: { some: { id: userId } },
      OR: [{ lastSyncedAt: { lt: cutoff } }, { lastSyncedAt: null }],
    },
    select: { id: true, title: true, lastSyncedAt: true },
    orderBy: { lastSyncedAt: "asc" },
  });
}

export async function getChannelsNeedingSync(hoursAgo = 24) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return getChannelsNeedingSyncForUser(userId, hoursAgo);
}

export async function syncChannelsBatch(channelIds: string[]) {
  const results = [];
  for (const channelId of channelIds) {
    try {
      await syncChannelVideos(channelId);
      results.push({ channelId, status: "success" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      results.push({ channelId, status: "error", error: message });
    }
  }
  return results;
}
