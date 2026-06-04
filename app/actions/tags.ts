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
          channel: { select: { id: true, title: true } },
          userStates: {
            where: { userId },
            select: { status: true },
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
