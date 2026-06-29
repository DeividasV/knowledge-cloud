"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { userVideosWhereWithCategory } from "@/lib/video-access";

export interface RecommendedVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date;
  durationSec: number | null;
  viewCount: number | null;
  channel: { id: string; title: string; subscriberCount: number | null } | null;
  videoTags: Array<{ id: string; name: string; score: number }>;
  score: number;
  reasons: string[];
  status: string;
}

export async function getRecommendations(options: {
  category?: string;
  limit?: number;
} = {}): Promise<RecommendedVideo[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;
  const limit = options.limit ?? 12;

  // 1. Get all user's visible videos with tags and statuses (category applied globally)
  const allVideos = await prisma.video.findMany({
    where: await userVideosWhereWithCategory(userId),
    select: {
      id: true,
      publishedAt: true,
      channelId: true,
      channel: { select: { id: true, categories: { select: { name: true } } } },
      videoTags: {
        select: { score: true, tag: { select: { id: true, name: true } } },
      },
      userStates: {
        where: { userId },
        select: { status: true },
      },
    },
  });

  // 2. Compute tag metrics
  type TagMetrics = {
    totalVideos: number;
    watchedVideos: number;
    totalScore: number;
    watchedScore: number;
  };

  const tagMetrics = new Map<string, TagMetrics>();

  for (const v of allVideos) {
    const status = v.userStates[0]?.status ?? "UNWATCHED";
    const isWatched = status === "WATCHED";

    for (const vt of v.videoTags) {
      const tagName = vt.tag.name;
      const existing = tagMetrics.get(tagName);
      if (existing) {
        existing.totalVideos++;
        existing.totalScore += vt.score;
        if (isWatched) {
          existing.watchedVideos++;
          existing.watchedScore += vt.score;
        }
      } else {
        tagMetrics.set(tagName, {
          totalVideos: 1,
          watchedVideos: isWatched ? 1 : 0,
          totalScore: vt.score,
          watchedScore: isWatched ? vt.score : 0,
        });
      }
    }
  }

  // 3. Filter to unwatched candidates
  const candidates = allVideos.filter((v) => {
    const status = v.userStates[0]?.status ?? "UNWATCHED";
    return status !== "WATCHED" && status !== "NOT_INTERESTED";
  });

  if (candidates.length === 0) return [];

  // 4. Get channel subscriber counts for candidates
  const channelIds = Array.from(
    new Set(candidates.map((v) => v.channelId).filter(Boolean))
  );
  const channels = await prisma.channel.findMany({
    where: { id: { in: channelIds as string[] } },
    select: { id: true, title: true, subscriberCount: true },
  });
  const channelMap = new Map(channels.map((c) => [c.id, c]));

  // 5. Get full video data for candidates
  const candidateIds = candidates.map((v) => v.id);
  const videoDetails = await prisma.video.findMany({
    where: { id: { in: candidateIds } },
    select: {
      id: true,
      title: true,
      thumbnail: true,
      publishedAt: true,
      durationSec: true,
      viewCount: true,
      channelId: true,
      videoTags: {
        select: { score: true, tag: { select: { id: true, name: true } } },
      },
      userStates: {
        where: { userId },
        select: { status: true },
      },
    },
  });

  // 6. Compute max values for normalization
  const now = Date.now();
  const maxViewCount = Math.max(
    ...videoDetails.map((v) => v.viewCount ?? 0),
    1
  );
  const maxSubscriberCount = Math.max(
    ...channels.map((c) => c.subscriberCount ?? 0),
    1
  );
  const maxTagVolume = Math.max(
    ...Array.from(tagMetrics.values()).map((m) => m.totalVideos),
    1
  );

  // 7. Score each candidate
  interface ScoredCandidate {
    video: typeof videoDetails[0];
    channel: (typeof channels)[0] | null;
    recencyScore: number;
    interestScore: number;
    completionBonus: number;
    volumeScore: number;
    popularityScore: number;
    channelQualityScore: number;
    baseScore: number;
    diversityScore?: number;
    reasons: string[];
  }

  const scored: ScoredCandidate[] = [];

  for (const v of videoDetails) {
    const ch = v.channelId ? channelMap.get(v.channelId) ?? null : null;
    const daysAgo =
      (now - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24);

    // Recency: exponential decay, newer is better
    const recencyScore = Math.exp(-0.025 * daysAgo);

    // Tag-based metrics
    let tagInterestSum = 0;
    let tagCompletionSum = 0;
    let tagVolumeSum = 0;
    let tagWeightSum = 0;
    const reasons: string[] = [];

    let bestInterestTag = "";
    let bestCompletionTag = "";
    let bestVolumeTag = "";
    let bestInterest = -Infinity;
    let bestCompletion = -Infinity;
    let bestVolume = -Infinity;

    for (const vt of v.videoTags) {
      const metrics = tagMetrics.get(vt.tag.name);
      if (!metrics) continue;

      const weight = vt.score;
      tagWeightSum += weight;

      // Interest ratio: how much user engages with this tag
      const interestRatio =
        metrics.totalScore > 0 ? metrics.watchedScore / metrics.totalScore : 0;
      tagInterestSum += interestRatio * weight;

      // Completion bonus: higher for tags close to completion
      // Use a curve that rewards mid-to-high completion
      const completionBonus =
        metrics.totalScore > 0
          ? Math.pow(metrics.watchedScore / metrics.totalScore, 1.5)
          : 0;
      tagCompletionSum += completionBonus * weight;

      // Volume: how many videos exist for this tag
      const volume = Math.log(metrics.totalVideos + 1) / Math.log(maxTagVolume + 1);
      tagVolumeSum += volume * weight;

      // Track the strongest tag for each metric so we can explain the reason
      if (interestRatio * weight > bestInterest) {
        bestInterest = interestRatio * weight;
        bestInterestTag = vt.tag.name;
      }
      if (completionBonus * weight > bestCompletion) {
        bestCompletion = completionBonus * weight;
        bestCompletionTag = vt.tag.name;
      }
      if (volume * weight > bestVolume) {
        bestVolume = volume * weight;
        bestVolumeTag = vt.tag.name;
      }
    }

    const interestScore = tagWeightSum > 0 ? tagInterestSum / tagWeightSum : 0.5;
    const completionBonus = tagWeightSum > 0 ? tagCompletionSum / tagWeightSum : 0;
    const volumeScore = tagWeightSum > 0 ? tagVolumeSum / tagWeightSum : 0.5;

    // Popularity from view count
    const popularityScore =
      v.viewCount && maxViewCount > 0
        ? Math.log(v.viewCount + 1) / Math.log(maxViewCount + 1)
        : 0.5;

    // Channel quality from subscriber count
    const channelQualityScore =
      ch?.subscriberCount && maxSubscriberCount > 0
        ? Math.log(ch.subscriberCount + 1) / Math.log(maxSubscriberCount + 1)
        : 0.5;

    // Build reasons
    if (recencyScore > 0.8) reasons.push("New");
    if (interestScore > 0.5 && bestInterestTag) {
      reasons.push(`You watch "${bestInterestTag}"`);
    }
    if (completionBonus > 0.35 && bestCompletionTag) {
      reasons.push(`Almost done with "${bestCompletionTag}"`);
    }
    if (volumeScore > 0.5 && bestVolumeTag) {
      reasons.push(`Popular topic "${bestVolumeTag}"`);
    }
    if (popularityScore > 0.7) reasons.push("Trending");

    // Always include at least one reason: the strongest signal
    if (reasons.length === 0) {
      const scoredReasons = [
        { label: "New", score: recencyScore },
        { label: `You watch "${bestInterestTag}"`, score: interestScore, needsTag: bestInterestTag },
        { label: `Popular topic "${bestVolumeTag}"`, score: volumeScore, needsTag: bestVolumeTag },
      ].filter((r) => !r.needsTag || r.needsTag);
      scoredReasons.sort((a, b) => b.score - a.score);
      const topReason = scoredReasons[0];
      if (topReason) reasons.push(topReason.label);
    }

    const baseScore =
      recencyScore * 0.25 +
      interestScore * 0.25 +
      completionBonus * 0.15 +
      volumeScore * 0.1 +
      popularityScore * 0.1 +
      channelQualityScore * 0.1 +
      (1 - interestScore) * 0.05; // Small novelty boost for less-seen topics

    scored.push({
      video: v,
      channel: ch,
      recencyScore,
      interestScore,
      completionBonus,
      volumeScore,
      popularityScore,
      channelQualityScore,
      baseScore,
      reasons,
    });
  }

  // 8. Diversity re-ranking (MMR-style)
  // Sort by base score, then greedily pick with diversity boost
  scored.sort((a, b) => b.baseScore - a.baseScore);

  const selected: ScoredCandidate[] = [];
  const selectedTagNames = new Set<string>();

  // Take top 3 purely by score (anchors), then apply diversity
  for (let i = 0; i < Math.min(3, scored.length); i++) {
    selected.push(scored[i]);
    for (const vt of scored[i].video.videoTags) {
      selectedTagNames.add(vt.tag.name);
    }
  }

  // For remaining slots, penalize overlap with selected tags
  const remaining = scored.slice(3);
  while (selected.length < limit && remaining.length > 0) {
    // Score remaining candidates with diversity penalty
    for (const cand of remaining) {
      const candTags = new Set(cand.video.videoTags.map((vt) => vt.tag.name));
      let overlap = 0;
      for (const tag of candTags) {
        if (selectedTagNames.has(tag)) overlap++;
      }
      // Diversity factor: 1.0 for no overlap, decreasing with overlap
      const diversityFactor = Math.pow(0.82, overlap);
      cand.diversityScore = cand.baseScore * diversityFactor;
    }

    remaining.sort((a, b) => (b.diversityScore ?? 0) - (a.diversityScore ?? 0));
    const pick = remaining.shift()!;
    selected.push(pick);
    for (const vt of pick.video.videoTags) {
      selectedTagNames.add(vt.tag.name);
    }
  }

  return selected.map((s, index) => ({
    id: s.video.id,
    title: s.video.title,
    thumbnail: s.video.thumbnail,
    publishedAt: s.video.publishedAt,
    durationSec: s.video.durationSec,
    viewCount: s.video.viewCount,
    channel: s.channel,
    videoTags: s.video.videoTags.map((vt) => ({
      id: vt.tag.id,
      name: vt.tag.name,
      score: vt.score,
    })),
    score: s.baseScore,
    reasons: index >= 3 ? [...s.reasons, "Diverse pick"] : s.reasons,
    status: s.video.userStates[0]?.status ?? "UNWATCHED",
  }));
}
