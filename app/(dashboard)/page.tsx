import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getDashboardStats } from "@/app/actions/videos";
import { TagDashboardStats } from "@/components/tag-dashboard-stats";
import { CategoryDashboard } from "@/components/category-dashboard";
import { VideoCard, VideoCardData } from "@/components/video-card";
import { VideoStatus } from "@/lib/types";
import { userVideosWhereWithCategory } from "@/lib/video-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tv,
  PlaySquare,
  Eye,
  EyeOff,
  Tag,
  Clock,
  Sparkles,
  PlayCircle,
} from "lucide-react";

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const videoListInclude = {
    channel: true,
    videoTags: {
      include: { tag: true },
      orderBy: { score: "desc" },
    },
    userStates: { where: { userId } },
  } satisfies Prisma.VideoInclude;

  type VideoListItem = Prisma.VideoGetPayload<{
    include: typeof videoListInclude;
  }>;

  function toCardData(
    video: VideoListItem,
    lastVisitAt: Date | null
  ): VideoCardData {
    return {
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      publishedAt: video.publishedAt,
      durationSec: video.durationSec,
      transcript: video.transcript,
      videoTags: video.videoTags.map((vt) => ({
        id: vt.tag.id,
        name: vt.tag.name,
        score: vt.score,
      })),
      status: (video.userStates[0]?.status as VideoStatus) || "UNWATCHED",
      progressSec: video.userStates[0]?.progressSec ?? null,
      isNew: !!lastVisitAt && video.publishedAt > lastVisitAt,
    };
  }

  function VideoSubtitle({ video }: { video: VideoListItem }) {
    return (
      <>
        {video.channel?.title ?? (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            Standalone
          </span>
        )}
        {video.category ? ` · ${video.category}` : ""}
        · {new Date(video.publishedAt).toLocaleDateString()}
        {video.durationSec ? (
          <span className="ml-2">
            {Math.floor(video.durationSec / 60)}:
            {String(video.durationSec % 60).padStart(2, "0")}
          </span>
        ) : null}
      </>
    );
  }

  const [stats, user, tagCount] = await Promise.all([
    getDashboardStats(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { selectedCategory: true, lastVisitAt: true },
    }),
    prisma.tag.count(),
  ]);

  const selectedCategory = user?.selectedCategory;
  const lastVisitAt = user?.lastVisitAt ?? null;

  const [newVideoData, continueWatching] = await Promise.all([
    (async () => {
      if (!lastVisitAt) {
        return { count: 0, videos: [] as VideoListItem[] };
      }
      const where: Prisma.VideoWhereInput = {
        AND: [
          await userVideosWhereWithCategory(userId),
          { publishedAt: { gt: lastVisitAt } },
          {
            NOT: {
              userStates: {
                some: {
                  userId,
                  status: { in: ["WATCHED", "NOT_INTERESTED"] },
                },
              },
            },
          },
        ],
      };
      const [videos, count] = await Promise.all([
        prisma.video.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          take: 6,
          include: videoListInclude,
        }),
        prisma.video.count({ where }),
      ]);
      return { count, videos };
    })(),
    (async () => {
      const states = await prisma.userVideo.findMany({
        where: {
          userId,
          progressSec: { gt: 0 },
          status: { notIn: ["WATCHED", "NOT_INTERESTED"] },
          video: await userVideosWhereWithCategory(userId),
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          video: { include: videoListInclude },
        },
      });
      return states.map((s) => s.video);
    })(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your subscriptions, watch progress, and tags.
          {selectedCategory && (
            <span className="ml-1 text-primary font-medium">
              · filtered by &quot;{selectedCategory}&quot;
            </span>
          )}
        </p>
      </div>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
              <PlaySquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVideos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unwatched</CardTitle>
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unwatched}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatHours(stats.unwatchedHours)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New videos</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{newVideoData.count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Watched</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.watched}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatHours(stats.watchedHours)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Channels</CardTitle>
              <Tv className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalChannels}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tags</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tagCount}</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── New videos ──────────────────────────────────────────── */}
      {newVideoData.count > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            New videos
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {newVideoData.videos.map((video) => (
              <VideoCard
                key={video.id}
                video={toCardData(video, lastVisitAt)}
                href={`/videos/${video.id}?from=%2F`}
                subtitle={<VideoSubtitle video={video} />}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Continue watching ───────────────────────────────────── */}
      {continueWatching.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            Continue watching
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {continueWatching.map((video) => (
              <VideoCard
                key={video.id}
                video={toCardData(video, lastVisitAt)}
                href={`/videos/${video.id}?from=%2F`}
                subtitle={<VideoSubtitle video={video} />}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Tags ────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Tags</h2>
        <TagDashboardStats />
      </section>

      {/* ── Categories ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Categories</h2>
        <CategoryDashboard />
      </section>
    </div>
  );
}
