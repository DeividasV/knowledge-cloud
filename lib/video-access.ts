import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Prisma where clause for videos visible to a user.
 * A video is visible if:
 * - it belongs to a channel the user follows, OR
 * - the user explicitly added it as a standalone video
 *
 * Also filters out videos shorter than the user's minVideoDurationSec setting.
 */
export async function userVideosWhere(
  userId: string
): Promise<Prisma.VideoWhereInput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { minVideoDurationSec: true },
  });
  const minDuration = user?.minVideoDurationSec ?? 0;

  const base: Prisma.VideoWhereInput = {
    OR: [
      { channel: { users: { some: { id: userId } } } },
      { userStates: { some: { userId, addedStandalone: true } } },
    ],
  };

  if (minDuration > 0) {
    return {
      AND: [
        base,
        {
          OR: [
            { durationSec: null },
            { durationSec: { gt: minDuration } },
          ],
        },
      ],
    };
  }

  return base;
}

/**
 * Same as userVideosWhere but also applies the user's selected category filter.
 * Use this on list/overview pages where category filtering makes sense.
 */
export async function userVideosWhereWithCategory(
  userId: string
): Promise<Prisma.VideoWhereInput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { minVideoDurationSec: true, selectedCategory: true },
  });
  const minDuration = user?.minVideoDurationSec ?? 0;
  const selectedCategory = user?.selectedCategory;

  const conditions: Prisma.VideoWhereInput[] = [
    {
      OR: [
        { channel: { users: { some: { id: userId } } } },
        { userStates: { some: { userId, addedStandalone: true } } },
      ],
    },
  ];

  if (minDuration > 0) {
    conditions.push({
      OR: [{ durationSec: null }, { durationSec: { gt: minDuration } }],
    });
  }

  if (selectedCategory) {
    conditions.push({
      channel: { categories: { some: { name: selectedCategory } } },
    });
  }

  return { AND: conditions };
}
