"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { VideoStatus } from "@/lib/types";
import { revalidatePath } from "next/cache";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function updateVideoStatus(
  videoId: string,
  status: VideoStatus,
  progressSec?: number
) {
  const userId = await getUserId();

  const existing = await prisma.userVideo.findUnique({
    where: { userId_videoId: { userId, videoId } },
  });

  let result;
  if (existing) {
    result = await prisma.userVideo.update({
      where: { id: existing.id },
      data: {
        status,
        ...(progressSec !== undefined ? { progressSec } : {}),
      },
    });
  } else {
    result = await prisma.userVideo.create({
      data: {
        userId,
        videoId,
        status,
        progressSec: progressSec ?? 0,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return result;
}

export async function markAllChannelVideosAsWatched(channelId: string) {
  const userId = await getUserId();

  const videos = await prisma.video.findMany({
    where: { channelId },
    select: { id: true },
  });

  const operations = videos.map((video) =>
    prisma.userVideo.upsert({
      where: { userId_videoId: { userId, videoId: video.id } },
      update: { status: "WATCHED", progressSec: 0 },
      create: {
        userId,
        videoId: video.id,
        status: "WATCHED",
        progressSec: 0,
      },
    })
  );

  await prisma.$transaction(operations);
  revalidatePath("/");
  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
}

export async function getRecentVideos(limit = 10) {
  const userId = await getUserId();

  const videos = await prisma.video.findMany({
    where: { channel: { users: { some: { id: userId } } } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      channel: true,
      userStates: {
        where: { userId },
      },
    },
  });

  return videos;
}

export async function getDashboardStats() {
  const userId = await getUserId();

  const [totalChannels, totalVideos, stats] = await Promise.all([
    prisma.channel.count({
      where: { users: { some: { id: userId } } },
    }),
    prisma.video.count({
      where: { channel: { users: { some: { id: userId } } } },
    }),
    prisma.userVideo.groupBy({
      by: ["status"],
      where: { userId },
      _count: { status: true },
    }),
  ]);

  const statusCounts = {
    UNWATCHED: 0,
    WATCHING: 0,
    WATCHED: 0,
    NOT_INTERESTED: 0,
  };

  for (const s of stats) {
    const key = s.status as keyof typeof statusCounts;
    statusCounts[key] = s._count.status;
  }

  return {
    totalChannels,
    totalVideos,
    unwatched: statusCounts.UNWATCHED,
    watching: statusCounts.WATCHING,
    watched: statusCounts.WATCHED,
    notInterested: statusCounts.NOT_INTERESTED,
  };
}
