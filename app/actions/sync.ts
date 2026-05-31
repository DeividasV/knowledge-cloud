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
    const data = {
      id: ch.id,
      title: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url,
      uploadsPlaylistId,
      subscriberCount: ch.statistics?.subscriberCount ? parseInt(ch.statistics.subscriberCount, 10) : null,
      videoCount: ch.statistics?.videoCount ? parseInt(ch.statistics.videoCount, 10) : null,
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

  for (const v of videoDetails) {
    const data = {
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      durationSec: parseDuration(v.contentDetails.duration),
      publishedAt: new Date(v.snippet.publishedAt),
      channelId: channelId,
    };

    if (existingIds.has(v.id)) {
      await prisma.video.update({ where: { id: v.id }, data });
    } else {
      await prisma.video.create({ data });
    }
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: { lastSyncedAt: new Date() },
  });

  revalidatePath("/");
  revalidatePath("/channels/[channelId]");
  revalidatePath("/videos");
  revalidatePath("/settings");
}

export async function syncAllChannelsVideos() {
  const session = await auth();
  const userId = session!.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { channels: true },
  });

  if (!user) throw new Error("User not found");

  for (const channel of user.channels) {
    try {
      await syncChannelVideos(channel.id);
    } catch (e: any) {
      console.error(`Failed to sync ${channel.title}:`, e.message);
    }
  }

  revalidatePath("/");
  revalidatePath("/channels");
  revalidatePath("/videos");
  revalidatePath("/settings");
}
