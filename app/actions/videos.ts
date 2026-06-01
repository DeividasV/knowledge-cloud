"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { VideoStatus } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { fetchVideoTranscript } from "@/lib/transcript";
import { extractTags, buildCorpus } from "@/lib/tags";

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

async function getUserMaxTags(): Promise<number> {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { maxTagsPerVideo: true },
  });
  return user?.maxTagsPerVideo ?? 8;
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
      videoTags: {
        include: { tag: true },
        orderBy: { score: "desc" },
      },
      userStates: {
        where: { userId },
      },
    },
  });

  return videos;
}

export async function getDashboardStats() {
  const userId = await getUserId();

  const [totalChannels, totalVideos, stats, transcriptCount] = await Promise.all([
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
    prisma.video.count({
      where: {
        channel: { users: { some: { id: userId } } },
        transcript: { not: null },
      },
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
    transcriptCount,
    unwatched: statusCounts.UNWATCHED,
    watching: statusCounts.WATCHING,
    watched: statusCounts.WATCHED,
    notInterested: statusCounts.NOT_INTERESTED,
  };
}

// ── Channel categories ──────────────────────────────────────────────

export async function addChannelCategory(channelId: string, categoryName: string) {
  await getUserId();
  const name = categoryName.trim();
  if (!name) throw new Error("Category name is required");

  const cat = await prisma.category.upsert({
    where: { name },
    create: { name },
    update: {},
  });

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      categories: { connect: { id: cat.id } },
    },
  });

  revalidatePath("/channels");
  revalidatePath("/channels/[channelId]");
}

export async function removeChannelCategory(channelId: string, categoryName: string) {
  await getUserId();
  const name = categoryName.trim();
  if (!name) throw new Error("Category name is required");

  const cat = await prisma.category.findUnique({ where: { name } });
  if (!cat) return;

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      categories: { disconnect: { id: cat.id } },
    },
  });

  revalidatePath("/channels");
  revalidatePath("/channels/[channelId]");
}

// ── Transcript actions ──────────────────────────────────────────────

export async function fetchAndStoreTranscript(videoId: string) {
  await getUserId();

  const result = await fetchVideoTranscript(videoId);

  if (!result) {
    throw new Error("Transcript not available for this video.");
  }

  await prisma.video.update({
    where: { id: videoId },
    data: {
      transcript: result.text,
      transcriptFetchedAt: new Date(),
    },
  });

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { success: true, length: result.text.length, lang: result.lang };
}

export async function getTranscriptStats() {
  await getUserId();

  const [withTranscript, withoutTranscript] = await Promise.all([
    prisma.video.count({ where: { transcript: { not: null } } }),
    prisma.video.count({ where: { transcript: null } }),
  ]);

  return { withTranscript, withoutTranscript };
}

export async function fetchTranscriptsBatch(videoIds: string[]) {
  await getUserId();

  const results = [];
  for (const videoId of videoIds) {
    try {
      const result = await fetchVideoTranscript(videoId);
      if (result) {
        await prisma.video.update({
          where: { id: videoId },
          data: {
            transcript: result.text,
            transcriptFetchedAt: new Date(),
          },
        });
        results.push({ videoId, status: "success", length: result.text.length });
      } else {
        results.push({ videoId, status: "unavailable" });
      }
    } catch (e: any) {
      results.push({ videoId, status: "error", error: e.message });
    }
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return results;
}

// ── Tag generation ──────────────────────────────────────────────────

export async function generateVideoTags(videoId: string) {
  await getUserId();
  const maxTags = await getUserMaxTags();

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { videoTags: { include: { tag: true } } },
  });

  if (!video) throw new Error("Video not found");

  // Build corpus from all videos for TF-IDF
  const allVideos = await prisma.video.findMany({
    select: { title: true, description: true, transcript: true },
  });
  const corpus = buildCorpus(allVideos);

  const tagNames = extractTags(video.title, video.description, video.transcript, {
    maxTags,
    corpusPhrases: corpus,
  });

  // Delete existing videoTag relations and create new ones with scores
  await prisma.videoTag.deleteMany({ where: { videoId } });

  for (const { name, score } of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });

    await prisma.videoTag.create({
      data: {
        videoId,
        tagId: tag.id,
        score,
      },
    });
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { success: true, tags: tagNames };
}

export async function generateTagsForUntagged(limit = 100) {
  await getUserId();
  const maxTags = await getUserMaxTags();

  // Find videos without tags
  const untaggedVideos = await prisma.video.findMany({
    where: {
      videoTags: { none: {} },
      OR: [
        { transcript: { not: null } },
        { description: { not: null } },
      ],
    },
    select: { id: true, title: true, description: true, transcript: true },
    take: limit,
  });

  if (untaggedVideos.length === 0) {
    return { processed: 0, tags: [] };
  }

  // Build corpus from all videos for TF-IDF
  const allVideos = await prisma.video.findMany({
    select: { title: true, description: true, transcript: true },
  });
  const corpus = buildCorpus(allVideos);

  const results = [];
  for (const video of untaggedVideos) {
    const extractedTags = extractTags(video.title, video.description, video.transcript, {
      maxTags,
      corpusPhrases: corpus,
    });

    if (extractedTags.length > 0) {
      await prisma.videoTag.deleteMany({ where: { videoId: video.id } });

      for (const { name, score } of extractedTags) {
        const tag = await prisma.tag.upsert({
          where: { name },
          create: { name },
          update: {},
        });

        await prisma.videoTag.create({
          data: {
            videoId: video.id,
            tagId: tag.id,
            score,
          },
        });
      }

      results.push({ videoId: video.id, tags: extractedTags.map((t) => t.name) });
    }
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { processed: untaggedVideos.length, generated: results.length, results };
}

export async function generateTagsForAll(limit = 100) {
  await getUserId();
  const maxTags = await getUserMaxTags();

  const videos = await prisma.video.findMany({
    where: {
      OR: [
        { transcript: { not: null } },
        { description: { not: null } },
      ],
    },
    select: { id: true, title: true, description: true, transcript: true },
    take: limit,
  });

  if (videos.length === 0) {
    return { processed: 0, tags: [] };
  }

  const allVideos = await prisma.video.findMany({
    select: { title: true, description: true, transcript: true },
  });
  const corpus = buildCorpus(allVideos);

  const results = [];
  for (const video of videos) {
    const extractedTags = extractTags(video.title, video.description, video.transcript, {
      maxTags,
      corpusPhrases: corpus,
    });

    if (extractedTags.length > 0) {
      await prisma.videoTag.deleteMany({ where: { videoId: video.id } });

      for (const { name, score } of extractedTags) {
        const tag = await prisma.tag.upsert({
          where: { name },
          create: { name },
          update: {},
        });

        await prisma.videoTag.create({
          data: {
            videoId: video.id,
            tagId: tag.id,
            score,
          },
        });
      }

      results.push({ videoId: video.id, tags: extractedTags.map((t) => t.name) });
    }
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { processed: videos.length, generated: results.length, results };
}

export async function getTagStats() {
  await getUserId();

  const [totalTags, taggedVideos, untaggedVideos] = await Promise.all([
    prisma.tag.count(),
    prisma.video.count({ where: { videoTags: { some: {} } } }),
    prisma.video.count({ where: { videoTags: { none: {} } } }),
  ]);

  return { totalTags, taggedVideos, untaggedVideos };
}

export async function getMaxTagsSetting() {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { maxTagsPerVideo: true },
  });
  return user?.maxTagsPerVideo ?? 8;
}

export async function setMaxTagsSetting(value: number) {
  const userId = await getUserId();
  const maxTags = Math.max(1, Math.min(50, Math.round(value)));
  await prisma.user.update({
    where: { id: userId },
    data: { maxTagsPerVideo: maxTags },
  });
  return maxTags;
}
