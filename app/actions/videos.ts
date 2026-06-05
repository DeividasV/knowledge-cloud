"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { VideoStatus } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { fetchVideoTranscript } from "@/lib/transcript";
import {
  extractVideoTags,
  checkTagExtractionAvailable,
} from "@/lib/tag-extractor";
import {
  extractVideoId,
  fetchVideoById,
  fetchVideoByIdFallback,
  fetchChannelDetailsById,
  parseDuration,
  getCategoryFromTopics,
  YOUTUBE_CATEGORY_MAP,
} from "@/lib/youtube";
import { userVideosWhere } from "@/lib/video-access";

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
  revalidatePath("/videos/[videoId]");
  return result;
}

export async function deleteVideoTags(videoIds: string[]) {
  await getUserId();
  if (videoIds.length === 0) return { deleted: 0 };

  const result = await prisma.videoTag.deleteMany({
    where: { videoId: { in: videoIds } },
  });

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  revalidatePath("/videos/[videoId]");
  return { deleted: result.count };
}

export async function deleteTagsForVideosWithRussianTags() {
  await getUserId();

  const videoTags = await prisma.videoTag.findMany({
    where: {
      tag: {
        name: { contains: "а" },
      },
    },
    select: { videoId: true, tag: { select: { name: true } } },
  });

  const cyrillicRegex = /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]/u;
  const affectedVideoIds = Array.from(
    new Set(
      videoTags
        .filter((vt) => cyrillicRegex.test(vt.tag.name))
        .map((vt) => vt.videoId)
    )
  );

  if (affectedVideoIds.length === 0) {
    return { deleted: 0, affectedVideos: 0 };
  }

  const result = await prisma.videoTag.deleteMany({
    where: { videoId: { in: affectedVideoIds } },
  });

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  revalidatePath("/videos/[videoId]");
  return { deleted: result.count, affectedVideos: affectedVideoIds.length };
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
  revalidatePath("/videos/[videoId]");
}

export async function getVideoById(videoId: string) {
  const userId = await getUserId();

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      ...userVideosWhere(userId),
    },
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

  return video;
}

export async function getRecentVideos(limit = 10) {
  const userId = await getUserId();

  const videos = await prisma.video.findMany({
    where: userVideosWhere(userId),
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
      where: userVideosWhere(userId),
    }),
    prisma.userVideo.groupBy({
      by: ["status"],
      where: { userId },
      _count: { status: true },
    }),
    prisma.video.count({
      where: {
        ...userVideosWhere(userId),
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
  revalidatePath("/videos/[videoId]");
  return { success: true, length: result.text.length, lang: result.lang };
}

export async function getTranscriptStats() {
  const userId = await getUserId();

  const [withTranscript, withoutTranscript] = await Promise.all([
    prisma.video.count({ where: { ...userVideosWhere(userId), transcript: { not: null } } }),
    prisma.video.count({ where: { ...userVideosWhere(userId), transcript: null } }),
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
  revalidatePath("/videos/[videoId]");
  return results;
}

export async function getChannelVideosWithoutTranscript(channelId: string) {
  await getUserId();

  const videos = await prisma.video.findMany({
    where: {
      channelId,
      transcript: null,
    },
    select: { id: true },
    take: 500,
  });

  return videos.map((v) => v.id);
}

// ── Tag generation ──────────────────────────────────────────────────

async function getUserTagExtractionConfig(): Promise<{
  method: string;
  geminiModel: string;
  ollamaMaxChunks: number;
  tagLanguage: string;
  maxTagsPerVideo: number;
}> {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tagExtractionMethod: true,
      geminiModel: true,
      ollamaMaxChunks: true,
      tagLanguage: true,
      maxTagsPerVideo: true,
    },
  });
  return {
    method: user?.tagExtractionMethod || process.env.TAG_EXTRACTION_METHOD || "ollama",
    geminiModel: user?.geminiModel || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    ollamaMaxChunks: user?.ollamaMaxChunks ?? 5,
    tagLanguage: user?.tagLanguage ?? "en",
    maxTagsPerVideo: user?.maxTagsPerVideo ?? 8,
  };
}

export async function generateVideoTags(videoId: string) {
  await getUserId();

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { videoTags: { include: { tag: true } } },
  });

  if (!video) throw new Error("Video not found");

  // Auto-fetch transcript if missing
  let transcript = video.transcript;
  if (!transcript) {
    try {
      const result = await fetchVideoTranscript(videoId);
      if (result) {
        transcript = result.text;
        await prisma.video.update({
          where: { id: videoId },
          data: {
            transcript: result.text,
            transcriptFetchedAt: new Date(),
          },
        });
      }
    } catch {
      // Proceed without transcript
    }
  }

  const { method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo } = await getUserTagExtractionConfig();

  let extracted;
  try {
    extracted = await extractVideoTags(video.title, transcript, method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo);
  } catch (err: any) {
    if (err?.message?.includes("credits depleted")) {
      throw err;
    }
    const backend = method === "gemini" ? "Gemini" : "Ollama";
    throw new Error(
      `Tag extraction failed via ${backend}: ${err?.message || "Unknown error"}`
    );
  }

  if (!extracted || extracted.length === 0) {
    const backend = method === "gemini" ? "Gemini" : "Ollama";
    throw new Error(
      `Tag extraction via ${backend} returned no tags. ` +
        (method === "gemini"
          ? "The model may have refused to process this content, or the transcript was too short."
          : "Make sure Ollama is running and the model is loaded. The video transcript may be too long for the 180s timeout.")
    );
  }

  const tagNames = extracted;

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
  revalidatePath("/videos/[videoId]");
  return { success: true, tags: tagNames };
}

export async function generateTagsForUntagged(limit = 100) {
  const userId = await getUserId();

  const untaggedVideos = await prisma.video.findMany({
    where: {
      ...userVideosWhere(userId),
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

  const { method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo } = await getUserTagExtractionConfig();

  const available = await checkTagExtractionAvailable(method);
  if (!available) {
    throw new Error(
      "Tag extraction backend is not available. Check your Ollama server or Gemini API key."
    );
  }

  const results = [];
  for (const video of untaggedVideos) {
    const extracted = await extractVideoTags(video.title, video.transcript, method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo);
    if (!extracted || extracted.length === 0) continue;

    const tagNames = extracted;

    await prisma.videoTag.deleteMany({ where: { videoId: video.id } });

    for (const { name, score } of tagNames) {
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

    results.push({ videoId: video.id, tags: tagNames.map((t) => t.name) });
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { processed: untaggedVideos.length, generated: results.length, results };
}

export async function generateTagsForAll(limit = 100) {
  const userId = await getUserId();

  const videos = await prisma.video.findMany({
    where: {
      ...userVideosWhere(userId),
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

  const { method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo } = await getUserTagExtractionConfig();

  const available = await checkTagExtractionAvailable(method);
  if (!available) {
    throw new Error(
      "Tag extraction backend is not available. Check your Ollama server or Gemini API key."
    );
  }

  const results = [];
  for (const video of videos) {
    const extracted = await extractVideoTags(video.title, video.transcript, method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo);
    if (!extracted || extracted.length === 0) continue;

    const tagNames = extracted;

    await prisma.videoTag.deleteMany({ where: { videoId: video.id } });

    for (const { name, score } of tagNames) {
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

    results.push({ videoId: video.id, tags: tagNames.map((t) => t.name) });
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { processed: videos.length, generated: results.length, results };
}

export async function generateTagsForChannel(channelId: string) {
  await getUserId();

  const videos = await prisma.video.findMany({
    where: { channelId },
    select: { id: true, title: true, description: true, transcript: true },
  });

  if (videos.length === 0) {
    return { processed: 0, generated: 0 };
  }

  const { method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo } = await getUserTagExtractionConfig();

  const available = await checkTagExtractionAvailable(method);
  if (!available) {
    throw new Error(
      "Tag extraction backend is not available. Check your Ollama server or Gemini API key."
    );
  }

  let generated = 0;
  for (const video of videos) {
    const extracted = await extractVideoTags(video.title, video.transcript, method, geminiModel, ollamaMaxChunks, tagLanguage, maxTagsPerVideo);
    if (!extracted || extracted.length === 0) continue;

    const tagNames = extracted;

    await prisma.videoTag.deleteMany({ where: { videoId: video.id } });

    for (const { name, score } of tagNames) {
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

    generated++;
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { processed: videos.length, generated };
}

export async function getTagExtractionMethodSetting(): Promise<string> {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tagExtractionMethod: true },
  });
  return user?.tagExtractionMethod || process.env.TAG_EXTRACTION_METHOD || "ollama";
}

export async function setTagExtractionMethodSetting(value: string) {
  const userId = await getUserId();
  const method = value === "gemini" ? "gemini" : "ollama";
  await prisma.user.update({
    where: { id: userId },
    data: { tagExtractionMethod: method },
  });
  return method;
}

export async function getGeminiModelSetting(): Promise<string> {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { geminiModel: true },
  });
  return user?.geminiModel || process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

export async function setGeminiModelSetting(value: string) {
  const userId = await getUserId();
  const model = value === "gemini-2.5-flash-lite" ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
  await prisma.user.update({
    where: { id: userId },
    data: { geminiModel: model },
  });
  return model;
}

export async function getOllamaMaxChunksSetting(): Promise<number> {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ollamaMaxChunks: true },
  });
  return user?.ollamaMaxChunks ?? 5;
}

export async function setOllamaMaxChunksSetting(value: number) {
  const userId = await getUserId();
  const maxChunks = Math.max(1, Math.min(50, Math.round(value)));
  await prisma.user.update({
    where: { id: userId },
    data: { ollamaMaxChunks: maxChunks },
  });
  return maxChunks;
}

export async function getTagLanguageSetting(): Promise<string> {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tagLanguage: true },
  });
  return user?.tagLanguage ?? "en";
}

export async function setTagLanguageSetting(value: string) {
  const userId = await getUserId();
  const lang = value === "lt" ? "lt" : "en";
  await prisma.user.update({
    where: { id: userId },
    data: { tagLanguage: lang },
  });
  return lang;
}

export async function getTagBatchModeSetting(): Promise<string> {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tagBatchMode: true },
  });
  return user?.tagBatchMode ?? "untagged";
}

export async function setTagBatchModeSetting(value: string) {
  const userId = await getUserId();
  const mode = value === "all" ? "all" : "untagged";
  await prisma.user.update({
    where: { id: userId },
    data: { tagBatchMode: mode },
  });
  return mode;
}

export interface TagWatchStats {
  name: string;
  totalScore: number;
  watchedScore: number;
  remainingScore: number;
  watchedCount: number;
  totalCount: number;
}

export async function getTagScoreSummary(): Promise<{
  totalScore: number;
  watchedScore: number;
  remainingScore: number;
}> {
  const userId = await getUserId();

  const videoTags = await prisma.videoTag.findMany({
    where: {
      video: userVideosWhere(userId),
    },
    select: {
      score: true,
      video: {
        select: {
          userStates: {
            where: { userId },
            select: { status: true },
          },
        },
      },
    },
  });

  let totalScore = 0;
  let watchedScore = 0;
  let remainingScore = 0;

  for (const vt of videoTags) {
    const status = vt.video.userStates[0]?.status ?? "UNWATCHED";
    totalScore += vt.score;
    if (status === "WATCHED") {
      watchedScore += vt.score;
    } else {
      remainingScore += vt.score;
    }
  }

  return { totalScore, watchedScore, remainingScore };
}

export async function getTopTagsWithWatchStats(limit = 10): Promise<{
  totalTags: number;
  topTags: TagWatchStats[];
}> {
  const userId = await getUserId();

  const totalTags = await prisma.tag.count();

  const videoTags = await prisma.videoTag.findMany({
    where: {
      video: userVideosWhere(userId),
    },
    select: {
      score: true,
      tag: { select: { id: true, name: true } },
      video: {
        select: {
          userStates: {
            where: { userId },
            select: { status: true },
          },
        },
      },
    },
  });

  const map = new Map<
    string,
    {
      name: string;
      totalScore: number;
      watchedScore: number;
      remainingScore: number;
      watchedCount: number;
      totalCount: number;
    }
  >();

  for (const vt of videoTags) {
    const status = vt.video.userStates[0]?.status ?? "UNWATCHED";
    const isWatched = status === "WATCHED";

    const existing = map.get(vt.tag.id);
    if (existing) {
      existing.totalScore += vt.score;
      existing.totalCount++;
      if (isWatched) {
        existing.watchedScore += vt.score;
        existing.watchedCount++;
      } else {
        existing.remainingScore += vt.score;
      }
    } else {
      map.set(vt.tag.id, {
        name: vt.tag.name,
        totalScore: vt.score,
        watchedScore: isWatched ? vt.score : 0,
        remainingScore: isWatched ? 0 : vt.score,
        watchedCount: isWatched ? 1 : 0,
        totalCount: 1,
      });
    }
  }

  const topTags: TagWatchStats[] = Array.from(map.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);

  return { totalTags, topTags };
}

export interface CategoryDashboardStat {
  name: string;
  totalVideos: number;
  watched: number;
  unwatched: number;
}

export async function getCategoryDashboardStats(): Promise<CategoryDashboardStat[]> {
  const userId = await getUserId();

  const categories = await prisma.category.findMany({
    where: {
      channels: { some: { users: { some: { id: userId } } } },
    },
    include: {
      channels: {
        where: { users: { some: { id: userId } } },
        include: {
          videos: {
            include: {
              userStates: {
                where: { userId },
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  const stats: CategoryDashboardStat[] = categories.map((cat) => {
    let totalVideos = 0;
    let watched = 0;
    let unwatched = 0;

    for (const channel of cat.channels) {
      for (const video of channel.videos) {
        totalVideos++;
        const status = video.userStates[0]?.status ?? "UNWATCHED";
        if (status === "WATCHED") watched++;
        else if (status === "UNWATCHED" || status === "WATCHING") unwatched++;
      }
    }

    return { name: cat.name, totalVideos, watched, unwatched };
  });

  return stats.sort((a, b) => b.totalVideos - a.totalVideos);
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

export async function getMaxVideosSetting() {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { maxVideosPerChannelSync: true },
  });
  return user?.maxVideosPerChannelSync ?? 500;
}

export async function setMaxVideosSetting(value: number) {
  const userId = await getUserId();
  const maxVideos = Math.max(50, Math.min(5000, Math.round(value)));
  await prisma.user.update({
    where: { id: userId },
    data: { maxVideosPerChannelSync: maxVideos },
  });
  return maxVideos;
}

export async function getMinDurationSetting() {
  const userId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { minVideoDurationSec: true },
  });
  return user?.minVideoDurationSec ?? 300;
}

export async function setMinDurationSetting(value: number) {
  const userId = await getUserId();
  const minSec = Math.max(0, Math.min(600, Math.round(value)));
  await prisma.user.update({
    where: { id: userId },
    data: { minVideoDurationSec: minSec },
  });
  return minSec;
}

// ── Batch tag generation helpers ──────────────────────────────────────

export async function getChannelVideoIds(channelId: string) {
  await getUserId();
  const videos = await prisma.video.findMany({
    where: { channelId },
    select: { id: true },
    orderBy: { publishedAt: "desc" },
  });
  return videos.map((v) => v.id);
}

export async function getChannelUntaggedVideoIds(channelId: string) {
  await getUserId();
  const videos = await prisma.video.findMany({
    where: {
      channelId,
      videoTags: { none: {} },
    },
    select: { id: true },
    orderBy: { publishedAt: "desc" },
  });
  return videos.map((v) => v.id);
}

export async function getUntaggedVideoIds(limit = 100) {
  const userId = await getUserId();
  const videos = await prisma.video.findMany({
    where: { ...userVideosWhere(userId), videoTags: { none: {} } },
    select: { id: true },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });
  return videos.map((v) => v.id);
}

export async function getAllVideoIds(limit = 100) {
  const userId = await getUserId();
  const videos = await prisma.video.findMany({
    where: userVideosWhere(userId),
    select: { id: true },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });
  return videos.map((v) => v.id);
}

export async function generateTagsBatch(videoIds: string[]) {
  await getUserId();

  const results = [];
  for (const videoId of videoIds) {
    try {
      const result = await generateVideoTags(videoId);
      results.push({ videoId, status: "success", tags: result.tags });
    } catch (e: any) {
      results.push({ videoId, status: "error", error: e.message });
    }
  }
  return results;
}

// ── Manual video addition ─────────────────────────────────────────────

export async function addVideoByUrl(url: string) {
  const userId = await getUserId();

  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube video URL");

  const existing = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, channelId: true },
  });

  if (existing) {
    // Always mark as standalone for this user
    await prisma.userVideo.upsert({
      where: { userId_videoId: { userId, videoId: existing.id } },
      update: { addedStandalone: true },
      create: {
        userId,
        videoId: existing.id,
        status: "UNWATCHED",
        progressSec: 0,
        addedStandalone: true,
      },
    });
    revalidatePath("/videos");
    revalidatePath("/channels/[channelId]");
    return { success: true, videoId, alreadyExisted: true };
  }

  let videoData;
  try {
    videoData = await fetchVideoById(videoId);
  } catch (e: any) {
    if (e?.message?.includes("YOUTUBE_API_KEY is not configured")) {
      videoData = await fetchVideoByIdFallback(videoId);
    } else {
      throw e;
    }
  }
  if (!videoData) throw new Error("Video not found on YouTube");

  const snippet = videoData.snippet;
  const contentDetails = videoData.contentDetails;
  const channelId = snippet.channelId || null;

  const catId = snippet.categoryId ? parseInt(snippet.categoryId, 10) : undefined;
  const category = catId ? YOUTUBE_CATEGORY_MAP[catId] : undefined;

  // Create/update channel record if we have channel info, but don't subscribe user
  if (channelId) {
    const channelExists = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true },
    });

    if (!channelExists) {
      try {
        const chData = await fetchChannelDetailsById(channelId);
        const ch = chData.items?.[0];
        if (ch) {
          const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads;
          const topicIds = ch.topicDetails?.topicIds as string[] | undefined;
          const detectedCategories: string[] = [];
          if (topicIds) {
            for (const id of topicIds) {
              const cat = getCategoryFromTopics([id]);
              if (cat) detectedCategories.push(cat);
            }
          }

          await prisma.channel.create({
            data: {
              id: ch.id,
              title: ch.snippet.title,
              thumbnail: ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url,
              uploadsPlaylistId,
              subscriberCount: ch.statistics?.subscriberCount ? parseInt(ch.statistics.subscriberCount, 10) : null,
              videoCount: ch.statistics?.videoCount ? parseInt(ch.statistics.videoCount, 10) : null,
            },
          });

          if (detectedCategories.length > 0) {
            for (const name of detectedCategories) {
              const cat = await prisma.category.upsert({
                where: { name },
                create: { name },
                update: {},
              });
              await prisma.channel.update({
                where: { id: ch.id },
                data: { categories: { connect: { id: cat.id } } },
              });
            }
          }
        }
      } catch {
        // Channel fetch failed (e.g. no API key) — store channel ID as-is
        await prisma.channel.upsert({
          where: { id: channelId },
          create: {
            id: channelId,
            title: snippet.channelTitle || "Unknown channel",
          },
          update: {},
        });
      }
    }
  }

  await prisma.video.create({
    data: {
      id: videoId,
      title: snippet.title,
      description: snippet.description,
      thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      durationSec: parseDuration(contentDetails.duration),
      publishedAt: new Date(snippet.publishedAt),
      channelId,
      category,
    },
  });

  await prisma.userVideo.create({
    data: {
      userId,
      videoId,
      status: "UNWATCHED",
      progressSec: 0,
      addedStandalone: true,
    },
  });

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  return { success: true, videoId, alreadyExisted: false };
}

export async function addVideoById(videoId: string) {
  return addVideoByUrl(videoId);
}

export async function removeVideo(videoId: string) {
  const userId = await getUserId();

  const userVideo = await prisma.userVideo.findUnique({
    where: { userId_videoId: { userId, videoId } },
  });

  if (userVideo?.addedStandalone) {
    await prisma.userVideo.delete({ where: { id: userVideo.id } });
  } else {
    // For channel videos, mark as not interested
    await prisma.userVideo.upsert({
      where: { userId_videoId: { userId, videoId } },
      update: { status: "NOT_INTERESTED" },
      create: {
        userId,
        videoId,
        status: "NOT_INTERESTED",
        progressSec: 0,
      },
    });
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
  revalidatePath("/videos/[videoId]");
}

export async function removeShortVideos() {
  const userId = await getUserId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { minVideoDurationSec: true },
  });
  const minDuration = user?.minVideoDurationSec ?? 300;

  // Find short videos from user's visible channels
  const shortVideos = await prisma.video.findMany({
    where: {
      ...userVideosWhere(userId),
      durationSec: { not: null, lte: minDuration },
    },
    select: { id: true },
  });

  if (shortVideos.length > 0) {
    await prisma.video.deleteMany({
      where: { id: { in: shortVideos.map((v) => v.id) } },
    });
  }

  revalidatePath("/videos");
  revalidatePath("/channels/[channelId]");
}
