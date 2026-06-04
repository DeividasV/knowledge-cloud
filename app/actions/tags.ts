"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface TagVideoItem {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date;
  durationSec: number | null;
  channel: { id: string; title: string };
  score: number;
  status: string;
  transcript: string | null;
  videoTags: Array<{
    tag: { id: string; name: string };
    score: number;
  }>;
}

export interface TagSibling {
  id: string;
  name: string;
  sharedVideos: number;
  totalVideos: number;
}

export interface TagDetail {
  id: string;
  name: string;
  totalVideos: number;
  watchedCount: number;
  unwatchedCount: number;
  notInterestedCount: number;
  totalScore: number;
  watchedScore: number;
  remainingScore: number;
  videos: TagVideoItem[];
  siblings: TagSibling[];
}

export async function getTagDetailByName(tagName: string): Promise<TagDetail | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  // 1. Find tag by name
  const tag = await prisma.tag.findUnique({
    where: { name: tagName },
    select: { id: true, name: true },
  });
  if (!tag) return null;

  // 2. Get all videoTags for this tag from user's channels
  const videoTags = await prisma.videoTag.findMany({
    where: {
      tagId: tag.id,
      video: {
        channel: { users: { some: { id: userId } } },
      },
    },
    select: {
      score: true,
      video: {
        select: {
          id: true,
          title: true,
          thumbnail: true,
          publishedAt: true,
          durationSec: true,
          transcript: true,
          channel: { select: { id: true, title: true } },
          userStates: {
            where: { userId },
            select: { status: true },
          },
          videoTags: {
            select: {
              score: true,
              tag: { select: { id: true, name: true } },
            },
            orderBy: { score: "desc" },
          },
        },
      },
    },
    orderBy: { score: "desc" },
    take: 100,
  });

  // 3. Aggregate stats
  let totalScore = 0;
  let watchedScore = 0;
  let remainingScore = 0;
  let watchedCount = 0;
  let unwatchedCount = 0;
  let notInterestedCount = 0;

  const videos: TagVideoItem[] = videoTags.map((vt) => {
    const status = vt.video.userStates[0]?.status ?? "UNWATCHED";
    totalScore += vt.score;
    if (status === "WATCHED") {
      watchedScore += vt.score;
      watchedCount++;
    } else if (status === "NOT_INTERESTED") {
      notInterestedCount++;
      remainingScore += vt.score;
    } else {
      remainingScore += vt.score;
      unwatchedCount++;
    }
    return {
      id: vt.video.id,
      title: vt.video.title,
      thumbnail: vt.video.thumbnail,
      publishedAt: vt.video.publishedAt,
      durationSec: vt.video.durationSec,
      channel: vt.video.channel,
      score: vt.score,
      status,
      transcript: vt.video.transcript,
      videoTags: vt.video.videoTags,
    };
  });

  // 4. Get sibling tags (co-occurring tags on same videos)
  const videoIds = videos.map((v) => v.id);
  let siblings: TagSibling[] = [];

  if (videoIds.length > 0) {
    const siblingVideoTags = await prisma.videoTag.findMany({
      where: {
        videoId: { in: videoIds },
        tagId: { not: tag.id },
      },
      select: {
        tagId: true,
        tag: { select: { id: true, name: true } },
        videoId: true,
      },
    });

    const siblingMap = new Map<
      string,
      { id: string; name: string; sharedVideos: Set<string> }
    >();

    for (const svt of siblingVideoTags) {
      const existing = siblingMap.get(svt.tagId);
      if (existing) {
        existing.sharedVideos.add(svt.videoId);
      } else {
        siblingMap.set(svt.tagId, {
          id: svt.tag.id,
          name: svt.tag.name,
          sharedVideos: new Set([svt.videoId]),
        });
      }
    }

    // Get total video counts for each sibling tag
    const siblingTagIds = Array.from(siblingMap.keys());
    if (siblingTagIds.length > 0) {
      const totalCounts = await prisma.videoTag.groupBy({
        by: ["tagId"],
        where: {
          tagId: { in: siblingTagIds },
          video: {
            channel: { users: { some: { id: userId } } },
          },
        },
        _count: { videoId: true },
      });

      const totalCountMap = new Map(
        totalCounts.map((tc) => [tc.tagId, tc._count.videoId])
      );

      siblings = Array.from(siblingMap.values())
        .map((s) => ({
          id: s.id,
          name: s.name,
          sharedVideos: s.sharedVideos.size,
          totalVideos: totalCountMap.get(s.id) ?? s.sharedVideos.size,
        }))
        .sort((a, b) => b.sharedVideos - a.sharedVideos)
        .slice(0, 20);
    }
  }

  return {
    id: tag.id,
    name: tag.name,
    totalVideos: videos.length,
    watchedCount,
    unwatchedCount,
    notInterestedCount,
    totalScore: Math.round(totalScore * 100) / 100,
    watchedScore: Math.round(watchedScore * 100) / 100,
    remainingScore: Math.round(remainingScore * 100) / 100,
    videos,
    siblings,
  };
}

export interface TagListItem {
  id: string;
  name: string;
  totalVideos: number;
  watchedCount: number;
  unwatchedCount: number;
  notInterestedCount: number;
  totalScore: number;
  watchedScore: number;
  remainingScore: number;
  completion: number;
}

export interface TagListResult {
  tags: TagListItem[];
  total: number;
}

export async function getAllTags(options: {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
  query?: string;
  filter?: string;
}): Promise<TagListResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  // Get all videoTags for user's channels
  const videoTags = await prisma.videoTag.findMany({
    where: {
      video: {
        channel: { users: { some: { id: userId } } },
      },
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

  // Aggregate by tag
  const tagMap = new Map<
    string,
    {
      id: string;
      name: string;
      totalScore: number;
      watchedScore: number;
      totalVideos: number;
      watchedCount: number;
      unwatchedCount: number;
      notInterestedCount: number;
    }
  >();

  for (const vt of videoTags) {
    const status = vt.video.userStates[0]?.status ?? "UNWATCHED";
    const existing = tagMap.get(vt.tag.id);
    if (existing) {
      existing.totalScore += vt.score;
      existing.totalVideos++;
      if (status === "WATCHED") {
        existing.watchedCount++;
        existing.watchedScore += vt.score;
      } else if (status === "NOT_INTERESTED") {
        existing.notInterestedCount++;
      } else {
        existing.unwatchedCount++;
      }
    } else {
      tagMap.set(vt.tag.id, {
        id: vt.tag.id,
        name: vt.tag.name,
        totalScore: vt.score,
        watchedScore: status === "WATCHED" ? vt.score : 0,
        totalVideos: 1,
        watchedCount: status === "WATCHED" ? 1 : 0,
        unwatchedCount: status === "UNWATCHED" || status === "WATCHING" ? 1 : 0,
        notInterestedCount: status === "NOT_INTERESTED" ? 1 : 0,
      });
    }
  }

  let tags = Array.from(tagMap.values()).map((t) => {
    const completion =
      t.totalScore > 0 ? Math.round((t.watchedScore / t.totalScore) * 100) : 0;
    return {
      id: t.id,
      name: t.name,
      totalVideos: t.totalVideos,
      watchedCount: t.watchedCount,
      unwatchedCount: t.unwatchedCount,
      notInterestedCount: t.notInterestedCount,
      totalScore: Math.round(t.totalScore * 100) / 100,
      watchedScore: Math.round(t.watchedScore * 100) / 100,
      remainingScore:
        Math.round((t.totalScore - t.watchedScore) * 100) / 100,
      completion,
    };
  });

  // Filter by search query
  if (options.query && options.query.trim()) {
    const q = options.query.trim().toLowerCase();
    tags = tags.filter((t) => t.name.toLowerCase().includes(q));
  }

  // Filter by completion status
  if (options.filter) {
    switch (options.filter) {
      case "complete":
        tags = tags.filter(
          (t) => t.totalVideos > 0 && t.watchedCount === t.totalVideos
        );
        break;
      case "in_progress":
        tags = tags.filter(
          (t) =>
            t.totalVideos > 0 &&
            t.watchedCount > 0 &&
            t.watchedCount < t.totalVideos
        );
        break;
      case "not_started":
        tags = tags.filter(
          (t) => t.totalVideos > 0 && t.watchedCount === 0
        );
        break;
    }
  }

  // Sort
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;
  switch (options.sortBy) {
    case "name":
      tags.sort((a, b) => sortOrder * a.name.localeCompare(b.name));
      break;
    case "videos":
      tags.sort((a, b) => sortOrder * (a.totalVideos - b.totalVideos));
      break;
    case "score":
      tags.sort((a, b) => sortOrder * (a.totalScore - b.totalScore));
      break;
    case "watchedScore":
      tags.sort((a, b) => sortOrder * (a.watchedScore - b.watchedScore));
      break;
    case "watched":
      tags.sort((a, b) => sortOrder * (a.watchedCount - b.watchedCount));
      break;
    case "completion":
      tags.sort((a, b) => sortOrder * (a.completion - b.completion));
      break;
    default:
      tags.sort((a, b) => sortOrder * (b.totalScore - a.totalScore));
      break;
  }

  const total = tags.length;
  const start = (options.page - 1) * options.pageSize;
  const paginated = tags.slice(start, start + options.pageSize);

  return { tags: paginated, total };
}
