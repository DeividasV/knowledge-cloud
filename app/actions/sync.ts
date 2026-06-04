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

  const allItems: any[] = [];
  let pageToken: string | undefined;

  do {
    const data = await fetchPlaylistItems(channel.uploadsPlaylistId, pageToken);
    allItems.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken && allItems.length < maxVideos);

  const videoIds = allItems.map((item: any) => item.snippet.resourceId.videoId).filter(Boolean);

  const videoDetails: any[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await fetchVideoDetails(batch);
    videoDetails.push(...(data.items || []));
  }

  const existingVideos = await prisma.video.findMany({
    where: { id: { in: videoIds } },
    select: { id: true },
  });
  const existingIds = new Set(existingVideos.map((v) => v.id));

  const categoryCounts = new Map<string, number>();
  const shortsToDelete: string[] = [];

  for (const v of videoDetails) {
    const durationSec = parseDuration(v.contentDetails.duration);

    if (durationSec > 0 && durationSec <= minDuration) {
      if (existingIds.has(v.id)) {
        shortsToDelete.push(v.id);
      }
      continue;
    }

    const catId = v.snippet?.categoryId ? parseInt(v.snippet.categoryId, 10) : undefined;
    const category = catId ? YOUTUBE_CATEGORY_MAP[catId] : undefined;
    if (category) {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }

    const data = {
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      durationSec,
      publishedAt: new Date(v.snippet.publishedAt),
      channelId: channelId,
      category,
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
