"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface TagGraphNode {
  id: string;
  name: string;
  videoCount: number;
  totalScore: number;
  watchedCount: number;
  unwatchedCount: number;
}

export interface TagGraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface TagGraphData {
  nodes: TagGraphNode[];
  edges: TagGraphEdge[];
}

export async function getTagGraph(
  maxTags = 150,
  minCooccurrence = 2,
  categoryNames?: string[]
): Promise<TagGraphData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  // Build channel filter
  const channelWhere: any = { users: { some: { id: userId } } };
  if (categoryNames && categoryNames.length > 0) {
    channelWhere.categories = { some: { name: { in: categoryNames } } };
  }

  // Get all video IDs from matching channels
  const videos = await prisma.video.findMany({
    where: { channel: channelWhere },
    select: { id: true },
  });
  const videoIdSet = new Set(videos.map((v) => v.id));

  if (videoIdSet.size === 0) {
    return { nodes: [], edges: [] };
  }

  // Get watch status for all videos in one query
  const userVideos = await prisma.userVideo.findMany({
    where: {
      userId,
      videoId: { in: Array.from(videoIdSet) },
      status: { in: ["WATCHED", "NOT_INTERESTED"] },
    },
    select: { videoId: true, status: true },
  });
  const watchedSet = new Set(userVideos.map((uv) => uv.videoId));

  // Get all videoTags for these videos
  const videoTags = await prisma.videoTag.findMany({
    where: { videoId: { in: Array.from(videoIdSet) } },
    include: { tag: true },
  });

  // Group by tag
  const tagMap = new Map<
    string,
    {
      name: string;
      videoIds: Set<string>;
      totalScore: number;
      watchedCount: number;
      unwatchedCount: number;
    }
  >();

  for (const vt of videoTags) {
    let data = tagMap.get(vt.tagId);
    if (!data) {
      data = {
        name: vt.tag.name,
        videoIds: new Set(),
        totalScore: 0,
        watchedCount: 0,
        unwatchedCount: 0,
      };
      tagMap.set(vt.tagId, data);
    }
    data.videoIds.add(vt.videoId);
    data.totalScore += vt.score;
    if (watchedSet.has(vt.videoId)) {
      data.watchedCount++;
    } else {
      data.unwatchedCount++;
    }
  }

  // Sort by video count and take top N
  const sortedTags = Array.from(tagMap.entries())
    .sort((a, b) => b[1].videoIds.size - a[1].videoIds.size)
    .slice(0, maxTags);

  const nodes: TagGraphNode[] = sortedTags.map(([id, data]) => ({
    id,
    name: data.name,
    videoCount: data.videoIds.size,
    totalScore: Math.round(data.totalScore * 100) / 100,
    watchedCount: data.watchedCount,
    unwatchedCount: data.unwatchedCount,
  }));

  // Compute co-occurrence edges
  const edges: TagGraphEdge[] = [];
  for (let i = 0; i < sortedTags.length; i++) {
    for (let j = i + 1; j < sortedTags.length; j++) {
      const [, dataA] = sortedTags[i];
      const [, dataB] = sortedTags[j];
      let shared = 0;
      for (const vid of dataA.videoIds) {
        if (dataB.videoIds.has(vid)) shared++;
      }
      if (shared >= minCooccurrence) {
        edges.push({
          source: sortedTags[i][0],
          target: sortedTags[j][0],
          weight: shared,
        });
      }
    }
  }

  return { nodes, edges };
}

export async function getVideosForTag(
  tagId: string,
  limit = 20,
  categoryNames?: string[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  const channelWhere: any = { users: { some: { id: userId } } };
  if (categoryNames && categoryNames.length > 0) {
    channelWhere.categories = { some: { name: { in: categoryNames } } };
  }

  return prisma.video.findMany({
    where: {
      channel: channelWhere,
      videoTags: { some: { tagId } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      channel: { select: { title: true } },
      videoTags: {
        where: { tagId },
        select: { score: true },
      },
      userStates: {
        where: { userId },
        select: { status: true },
      },
    },
  });
}

export async function getUserCategories() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  const categories = await prisma.category.findMany({
    where: {
      channels: { some: { users: { some: { id: userId } } } },
    },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return categories.map((c) => c.name);
}
