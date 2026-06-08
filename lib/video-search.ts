import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { userVideosWhereWithCategory } from "./video-access";

const PAGE_SIZE = 50;

export interface VideoSearchResult {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  durationSec: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  publishedAt: Date;
  transcript: string | null;
  category: string | null;
  channelId: string | null;
  channel: {
    id: string;
    title: string;
    thumbnail: string | null;
  } | null;
  videoTags: {
    tag: {
      id: string;
      name: string;
    };
    score: number;
  }[];
  userStates: {
    status: string;
    addedStandalone: boolean;
  }[];
  searchScore: number;
}

function scoreVideo(
  video: {
    title: string;
    description: string | null;
    transcript: string | null;
    videoTags: { tag: { name: string } }[];
  },
  query: string
): number {
  const q = query.toLowerCase().trim();
  const qWords = q.split(/\s+/).filter((w) => w.length > 0);
  let score = 0;

  // Title matches (highest priority)
  const title = video.title.toLowerCase();
  if (title === q) {
    score += 100;
  } else if (title.includes(q)) {
    score += 50;
  } else if (qWords.length > 1 && qWords.every((w) => title.includes(w))) {
    score += 40;
  }

  // Tag matches
  const tagNames = video.videoTags.map((vt) => vt.tag.name.toLowerCase());
  if (tagNames.some((t) => t.includes(q))) {
    score += 35;
  } else if (
    qWords.length > 1 &&
    qWords.every((w) => tagNames.some((t) => t.includes(w)))
  ) {
    score += 30;
  }

  // Description matches
  if (video.description) {
    const desc = video.description.toLowerCase();
    if (desc.includes(q)) {
      score += 25;
    } else if (qWords.length > 1 && qWords.every((w) => desc.includes(w))) {
      score += 20;
    }
  }

  // Transcript matches (lowest priority)
  if (video.transcript) {
    const trans = video.transcript.toLowerCase();
    if (trans.includes(q)) {
      score += 15;
    } else if (qWords.length > 1 && qWords.every((w) => trans.includes(w))) {
      score += 10;
    }
  }

  return score;
}

function buildSearchOr(query: string): Prisma.VideoWhereInput {
  return {
    OR: [
      { title: { contains: query } },
      { description: { contains: query } },
      { transcript: { contains: query } },
      { videoTags: { some: { tag: { name: { contains: query } } } } },
    ],
  };
}

function buildTabFilter(
  tab: string,
  userId: string
): Prisma.VideoWhereInput {
  switch (tab) {
    case "standalone":
      return { channelId: null };
    case "unwatched":
      return {
        NOT: {
          userStates: {
            some: {
              userId,
              status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] },
            },
          },
        },
      };
    case "watched":
      return { userStates: { some: { userId, status: "WATCHED" } } };
    case "not-interested":
      return { userStates: { some: { userId, status: "NOT_INTERESTED" } } };
    default:
      return {};
  }
}

export async function searchVideos({
  userId,
  query,
  tab,
  page,
}: {
  userId: string;
  query?: string;
  tab: string;
  page: number;
}): Promise<{ videos: VideoSearchResult[]; total: number }> {
  const skip = (page - 1) * PAGE_SIZE;
  const baseWhereClause = await userVideosWhereWithCategory(userId);
  const tabFilter = buildTabFilter(tab, userId);

  // No search — use efficient Prisma pagination directly
  if (!query || !query.trim()) {
    const where: Prisma.VideoWhereInput =
      Object.keys(tabFilter).length === 0
        ? baseWhereClause
        : { AND: [baseWhereClause, tabFilter] };

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take: PAGE_SIZE,
        include: {
          channel: true,
          videoTags: {
            include: { tag: true },
            orderBy: { score: "desc" },
          },
          userStates: { where: { userId } },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return {
      videos: videos.map((v) => ({ ...(v as any), searchScore: 0 })),
      total,
    };
  }

  // With search — fetch candidates, score in memory, paginate
  const q = query.trim();
  const searchOr = buildSearchOr(q);

  const where: Prisma.VideoWhereInput =
    Object.keys(tabFilter).length === 0
      ? { AND: [baseWhereClause, searchOr] }
      : { AND: [baseWhereClause, tabFilter, searchOr] };

  const allVideos = await prisma.video.findMany({
    where,
    include: {
      channel: true,
      videoTags: {
        include: { tag: true },
        orderBy: { score: "desc" },
      },
      userStates: { where: { userId } },
    },
  });

  const scored = allVideos.map((video) => ({
    ...(video as any),
    searchScore: scoreVideo(video, q),
  }));

  scored.sort((a, b) => {
    if (b.searchScore !== a.searchScore) {
      return b.searchScore - a.searchScore;
    }
    return (
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  });

  return {
    videos: scored.slice(skip, skip + PAGE_SIZE),
    total: scored.length,
  };
}
