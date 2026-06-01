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
    const category = getCategoryFromTopics(topicIds);
    const data = {
      id: ch.id,
      title: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url,
      uploadsPlaylistId,
      subscriberCount: ch.statistics?.subscriberCount ? parseInt(ch.statistics.subscriberCount, 10) : null,
      videoCount: ch.statistics?.videoCount ? parseInt(ch.statistics.videoCount, 10) : null,
      category,
      lastSyncedAt: new Date(),
    };

    if (existingIds.has(ch.id)) {
      await prisma.channel.update({ where: { id: ch.id }, data });
    } else {
      await prisma.channel.create({ data });
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

  for (const v of videoDetails) {
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
      durationSec: parseDuration(v.contentDetails.duration),
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

  // Auto-set channel category from most common video category if not set
  let mostCommonCategory: string | undefined;
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonCategory = cat;
    }
  }

  const channelUpdateData: any = { lastSyncedAt: new Date() };
  if (mostCommonCategory && !channel?.category) {
    channelUpdateData.category = mostCommonCategory;
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: channelUpdateData,
  });

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
