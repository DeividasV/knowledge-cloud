"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  resolveChannel,
  fetchChannelDetailsById,
  getCategoryFromTopics,
} from "@/lib/youtube";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

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

async function upsertChannelFromApiItem(ch: any) {
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
  };

  const existing = await prisma.channel.findUnique({
    where: { id: ch.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.channel.update({ where: { id: ch.id }, data: baseData });
  } else {
    await prisma.channel.create({ data: baseData });
  }

  if (detectedCategories.length > 0) {
    await setChannelCategories(ch.id, detectedCategories);
  }

  return ch.id;
}

export async function addChannelByUrl(url: string) {
  const userId = await getUserId();

  const data = await resolveChannel(url);
  const ch = data.items?.[0];
  if (!ch) throw new Error("Channel not found");

  const channelId = await upsertChannelFromApiItem(ch);

  // Link channel to user (add, don't replace existing)
  await prisma.user.update({
    where: { id: userId },
    data: {
      channels: { connect: { id: channelId } },
    },
  });

  revalidatePath("/channels");
  revalidatePath("/settings");
  return { success: true, channelId, title: ch.snippet.title };
}

export async function addChannelById(channelId: string) {
  const userId = await getUserId();

  const data = await fetchChannelDetailsById(channelId);
  const ch = data.items?.[0];
  if (!ch) throw new Error("Channel not found");

  const id = await upsertChannelFromApiItem(ch);

  await prisma.user.update({
    where: { id: userId },
    data: {
      channels: { connect: { id } },
    },
  });

  revalidatePath("/channels");
  revalidatePath("/settings");
  return { success: true, channelId: id, title: ch.snippet.title };
}

export async function removeChannel(channelId: string) {
  const userId = await getUserId();

  await prisma.user.update({
    where: { id: userId },
    data: {
      channels: { disconnect: { id: channelId } },
    },
  });

  revalidatePath("/channels");
  revalidatePath("/settings");
}

export async function getUserChannels() {
  const userId = await getUserId();

  const channels = await prisma.channel.findMany({
    where: { users: { some: { id: userId } } },
    orderBy: { title: "asc" },
    include: {
      categories: true,
      _count: { select: { videos: true } },
    },
  });

  return channels;
}
