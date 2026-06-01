"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface TagGraphNode {
  id: string;
  name: string;
  videoCount: number;
  totalScore: number;
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

export async function getTagGraph(maxTags = 150, minCooccurrence = 2): Promise<TagGraphData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  // Get top tags by video count (only from user's channels)
  const topTags = await prisma.tag.findMany({
    where: {
      videoTags: {
        some: {
          video: {
            channel: { users: { some: { id: userId } } },
          },
        },
      },
    },
    include: {
      videoTags: {
        where: {
          video: {
            channel: { users: { some: { id: userId } } },
          },
        },
        select: { videoId: true, score: true },
      },
    },
    orderBy: {
      videoTags: { _count: "desc" },
    },
    take: maxTags,
  });

  const tagMap = new Map<string, TagGraphNode>();
  const tagVideoIds = new Map<string, Set<string>>();

  for (const tag of topTags) {
    tagMap.set(tag.id, {
      id: tag.id,
      name: tag.name,
      videoCount: tag.videoTags.length,
      totalScore: tag.videoTags.reduce((s, vt) => s + vt.score, 0),
    });
    tagVideoIds.set(tag.id, new Set(tag.videoTags.map((vt) => vt.videoId)));
  }

  // Compute co-occurrence edges
  const tagIds = Array.from(tagMap.keys());
  const edges: TagGraphEdge[] = [];

  for (let i = 0; i < tagIds.length; i++) {
    for (let j = i + 1; j < tagIds.length; j++) {
      const a = tagIds[i];
      const b = tagIds[j];
      const setA = tagVideoIds.get(a)!;
      const setB = tagVideoIds.get(b)!;

      let shared = 0;
      for (const vid of setA) {
        if (setB.has(vid)) shared++;
      }

      if (shared >= minCooccurrence) {
        edges.push({ source: a, target: b, weight: shared });
      }
    }
  }

  // Also include within-video tag cliques (tags on same video strongly connected)
  // We already have this from co-occurrence, but boost weight for high scores

  return { nodes: Array.from(tagMap.values()), edges };
}

export async function getVideosForTag(tagId: string, limit = 20) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  return prisma.video.findMany({
    where: {
      channel: { users: { some: { id: userId } } },
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
    },
  });
}
