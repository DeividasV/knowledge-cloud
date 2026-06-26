import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Verify the user is linked to the given channel.
 */
export async function assertUserOwnsChannel(
  userId: string,
  channelId: string
): Promise<void> {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, users: { some: { id: userId } } },
    select: { id: true },
  });
  if (!channel) {
    throw new Error("Channel not found or access denied");
  }
}

/**
 * Verify the user has access to the given video (via a followed channel or
 * as a standalone video).
 */
export async function assertUserCanAccessVideo(
  userId: string,
  videoId: string
): Promise<void> {
  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      OR: [
        { channel: { users: { some: { id: userId } } } },
        { userStates: { some: { userId, addedStandalone: true } } },
      ],
    },
    select: { id: true },
  });
  if (!video) {
    throw new Error("Video not found or access denied");
  }
}

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

  if (minDuration > 0) {
    return {
      OR: [
        {
          channel: { users: { some: { id: userId } } },
          OR: [
            { durationSec: null },
            { durationSec: { gt: minDuration } },
          ],
        },
        { userStates: { some: { userId, addedStandalone: true } } },
      ],
    };
  }

  return {
    OR: [
      { channel: { users: { some: { id: userId } } } },
      { userStates: { some: { userId, addedStandalone: true } } },
    ],
  };
}

/**
 * Same as userVideosWhere but also applies the user's selected category filter.
 * Use this on list/overview pages where category filtering makes sense.
 *
 * Category is checked on BOTH the video itself (Video.category) and the
 * channel's categories (Channel.categories). This ensures standalone videos
 * and videos with a direct category assignment are included.
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

  // Visibility: which videos can this user see?
  const visibilityWhere: Prisma.VideoWhereInput =
    minDuration > 0
      ? {
          OR: [
            {
              channel: { users: { some: { id: userId } } },
              OR: [{ durationSec: null }, { durationSec: { gt: minDuration } }],
            },
            { userStates: { some: { userId, addedStandalone: true } } },
          ],
        }
      : {
          OR: [
            { channel: { users: { some: { id: userId } } } },
            { userStates: { some: { userId, addedStandalone: true } } },
          ],
        };

  // Category filter: applies to ALL visible videos
  const categoryWhere: Prisma.VideoWhereInput | null = selectedCategory
    ? {
        OR: [
          { category: selectedCategory },
          { channel: { categories: { some: { name: selectedCategory } } } },
        ],
      }
    : null;

  const conditions = [visibilityWhere, categoryWhere].filter(
    (c): c is Prisma.VideoWhereInput => c !== null && Object.keys(c).length > 0
  );

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}
