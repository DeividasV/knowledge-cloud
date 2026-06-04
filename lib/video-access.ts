import { Prisma } from "@prisma/client";

/**
 * Prisma where clause for videos visible to a user.
 * A video is visible if:
 * - it belongs to a channel the user follows, OR
 * - the user explicitly added it as a standalone video
 */
export function userVideosWhere(userId: string): Prisma.VideoWhereInput {
  return {
    OR: [
      { channel: { users: { some: { id: userId } } } },
      { userStates: { some: { userId, addedStandalone: true } } },
    ],
  };
}
