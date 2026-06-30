#!/usr/bin/env tsx
/**
 * Standalone channel resync script.
 * Runs outside the Next.js request lifecycle, so it bypasses auth.
 * Use only on servers you control.
 *
 * Usage (inside Docker container):
 *   npx tsx scripts/resync-channel.ts <channel-id>
 */
import { prisma } from "@/lib/prisma";
import {
  fetchPlaylistItems,
  fetchVideoDetails,
  parseDuration,
  YOUTUBE_CATEGORY_MAP,
  hasYoutubeApiKey,
  type YouTubePlaylistItem,
  type YouTubeVideo,
} from "@/lib/youtube";

async function setChannelCategories(channelId: string, categoryNames: string[]) {
  const uniqueNames = [...new Set(categoryNames.filter(Boolean))];
  if (uniqueNames.length === 0) return;

  const categoryIds: string[] = [];
  for (const name of uniqueNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    categoryIds.push(cat.id);
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      categories: {
        set: categoryIds.map((id) => ({ id })),
      },
    },
  });
}

async function propagateChannelCategoryToVideos(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: { orderBy: { name: "asc" } } },
  });
  if (!channel || channel.categories.length === 0) return;

  const primaryCategory = channel.categories[0].name;
  await prisma.video.updateMany({
    where: { channelId },
    data: { category: primaryCategory },
  });
}

async function resyncChannel(channelId: string) {
  if (!hasYoutubeApiKey()) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }

  // Use the first user's settings; in a single-user deployment this is fine.
  const user = await prisma.user.findFirst({
    select: { id: true, maxVideosPerChannelSync: true, minVideoDurationSec: true },
  });
  if (!user) throw new Error("No users found");

  const maxVideos = user.maxVideosPerChannelSync ?? 500;
  const minDuration = user.minVideoDurationSec ?? 300;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { categories: true },
  });
  if (!channel?.uploadsPlaylistId) {
    throw new Error("Channel has no uploads playlist");
  }

  console.log(`Resyncing "${channel.title}" (maxVideos=${maxVideos}, minDuration=${minDuration}s)`);

  const allItems: YouTubePlaylistItem[] = [];
  let pageToken: string | undefined;
  do {
    const data = await fetchPlaylistItems(channel.uploadsPlaylistId, pageToken);
    allItems.push(...(data.items || []));
    pageToken = data.nextPageToken;
    console.log(`  fetched ${allItems.length} playlist items...`);
  } while (pageToken);

  const videoIds = allItems
    .map((item) => item.snippet.resourceId?.videoId)
    .filter((id): id is string => Boolean(id));

  const apiDetails: YouTubeVideo[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await fetchVideoDetails(batch);
    apiDetails.push(...(data.items || []));
  }

  const videoDetails = apiDetails.map((v) => {
    const catId = v.snippet?.categoryId ? parseInt(v.snippet.categoryId, 10) : undefined;
    const tags = v.snippet?.tags;
    return {
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      durationSec: parseDuration(v.contentDetails?.duration || ""),
      viewCount: v.statistics?.viewCount ? parseInt(v.statistics.viewCount, 10) : null,
      likeCount: v.statistics?.likeCount ? parseInt(v.statistics.likeCount, 10) : null,
      commentCount: v.statistics?.commentCount ? parseInt(v.statistics.commentCount, 10) : null,
      youtubeTags: Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null,
      publishedAt: new Date(v.snippet.publishedAt),
      category: catId ? YOUTUBE_CATEGORY_MAP[catId] : undefined,
    };
  });

  const existingVideos = await prisma.video.findMany({
    where: { id: { in: videoDetails.map((v) => v.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existingVideos.map((v) => v.id));

  const categoryCounts = new Map<string, number>();
  const shortsToDelete: string[] = [];
  let storedCount = 0;

  for (const v of videoDetails) {
    if (v.durationSec !== null && v.durationSec > 0 && v.durationSec <= minDuration) {
      if (existingIds.has(v.id)) {
        shortsToDelete.push(v.id);
      }
      continue;
    }

    if (storedCount >= maxVideos) {
      continue;
    }
    storedCount++;

    if (v.category) {
      categoryCounts.set(v.category, (categoryCounts.get(v.category) || 0) + 1);
    }

    const data = {
      id: v.id,
      title: v.title,
      description: v.description,
      thumbnail: v.thumbnail,
      durationSec: v.durationSec,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      youtubeTags: v.youtubeTags,
      publishedAt: v.publishedAt,
      channelId: channelId,
      category: v.category,
    };

    if (existingIds.has(v.id)) {
      await prisma.video.update({ where: { id: v.id }, data });
    } else {
      await prisma.video.create({ data });
    }
  }

  if (shortsToDelete.length > 0) {
    await prisma.video.deleteMany({
      where: { id: { in: shortsToDelete } },
    });
  }

  let mostCommonCategory: string | undefined;
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonCategory = cat;
    }
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: { lastSyncedAt: new Date() },
  });

  if (mostCommonCategory && channel.categories.length === 0) {
    await setChannelCategories(channelId, [mostCommonCategory]);
  }

  await propagateChannelCategoryToVideos(channelId);

  console.log(`Done. Stored ${storedCount} videos, deleted ${shortsToDelete.length} shorts.`);
}

async function main() {
  const channelId = process.argv[2];
  if (!channelId) {
    console.error("Usage: npx tsx scripts/resync-channel.ts <channel-id>");
    process.exit(1);
  }
  await resyncChannel(channelId);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
