"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getValidAccessToken } from "@/lib/token";
import { revalidatePath } from "next/cache";
import {
  fetchSubscriptions,
  fetchChannelDetails,
  fetchPlaylistItems,
  fetchVideoDetails,
  parseDuration,
  getCategoryFromTopics,
  YOUTUBE_CATEGORY_MAP,
} from "@/lib/youtube";

async function getAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return getValidAccessToken(session.user.id);
}

async function setChannelCategories(channelId: string, categoryNames: string[]) {
  const uniqueNames = [...new Set(categoryNames.filter(Boolean))];
  if (uniqueNames.length === 0) return;

  // Ensure categories exist
  const categoryIds: string[] = [];
  for (const name of uniqueNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    categoryIds.push(cat.id);
  }

  // Replace channel categories
  await prisma.channel.update({
    where: { id: channelId },
    data: {
      categories: {
        set: categoryIds.map((id) => ({ id })),
      },
    },
  });
}

export async function syncSubscriptions() {
  const token = await getAccessToken();
  const session = await auth();
  const userId = session!.user!.id;

  const allSubs: any[] = [];
  let pageToken: string | undefined;

  do {
    const data = await fetchSubscriptions(token, pageToken);
    allSubs.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  const channelIds = allSubs.map((s: any) => s.snippet.resourceId.channelId);

  // Fetch channel details in batches of 50
  const channelDetails: any[] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await fetchChannelDetails(token, batch);
    channelDetails.push(...(data.items || []));
  }

  const existingChannels = await prisma.channel.findMany({
    where: { id: { in: channelIds } },
    select: { id: true },
  });
  const existingIds = new Set(existingChannels.map((c) => c.id));

  for (const ch of channelDetails) {
    const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads;
    const topicIds = ch.topicDetails?.topicIds as string[] | undefined;
    const detectedCategories: string[] = [];
    if (topicIds) {
      for (const id of topicIds) {
        const cat = getCategoryFromTopics([id]);
        if (cat) detectedCategories.push(cat);
      }
    }

    const baseData = {
      id: ch.id,
      title: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url,
      uploadsPlaylistId,
      subscriberCount: ch.statistics?.subscriberCount ? parseInt(ch.statistics.subscriberCount, 10) : null,
      videoCount: ch.statistics?.videoCount ? parseInt(ch.statistics.videoCount, 10) : null,
      lastSyncedAt: new Date(),
    };

    if (existingIds.has(ch.id)) {
      await prisma.channel.update({ where: { id: ch.id }, data: baseData });
    } else {
      await prisma.channel.create({ data: baseData });
    }

    // Set categories (replaces any auto-detected ones from previous syncs)
    if (detectedCategories.length > 0) {
      await setChannelCategories(ch.id, detectedCategories);
    }
  }

  // Connect channels to user
  await prisma.user.update({
    where: { id: userId },
    data: {
      channels: {
        set: channelIds.map((id: string) => ({ id })),
      },
      lastSyncAt: new Date(),
    },
  });

  revalidatePath("/");
  revalidatePath("/channels");
  revalidatePath("/settings");
}

export async function syncChannelVideos(channelId: string) {
  const token = await getAccessToken();

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
    const data = await fetchPlaylistItems(token, channel.uploadsPlaylistId, pageToken);
    allItems.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken && allItems.length < 200); // limit to avoid quota overuse

  const videoIds = allItems.map((item: any) => item.snippet.resourceId.videoId).filter(Boolean);

  // Fetch video details in batches
  const videoDetails: any[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await fetchVideoDetails(token, batch);
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

    // Skip short videos (≤5 minutes)
    if (durationSec > 0 && durationSec <= 300) {
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

  // Delete any existing videos that are now identified as shorts
  if (shortsToDelete.length > 0) {
    await prisma.video.deleteMany({
      where: { id: { in: shortsToDelete } },
    });
  }

  // Auto-set channel category from most common video category if channel has none
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
  const userId = session!.user!.id;

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
