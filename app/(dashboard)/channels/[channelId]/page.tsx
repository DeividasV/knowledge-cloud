import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaySquare, CheckCircle, RefreshCw, FileText } from "lucide-react";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { VideoQuickToggle } from "@/components/video-quick-toggle";
import { VideoTranscript } from "@/components/video-transcript";
import { VideoTags } from "@/components/video-tags";
import { VideoStatus } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { markAllChannelVideosAsWatched } from "@/app/actions/videos";
import { syncChannelVideos } from "@/app/actions/sync";
import { PendingButton } from "@/components/pending-button";
import { ChannelCategoryManager } from "@/components/channel-category-manager";
import { ChannelTranscriptFetch } from "@/components/channel-transcript-fetch";

const PAGE_SIZE = 50;

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;

  const { channelId } = await params;
  const { page: pageStr, status: statusFilter, q: query } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      users: { some: { id: userId } },
    },
    include: { categories: true },
  });

  if (!channel) notFound();

  const searchWhere = query
    ? { title: { contains: query } }
    : {};

  const statusWhere =
    statusFilter && ["UNWATCHED", "WATCHED", "NOT_INTERESTED"].includes(statusFilter)
      ? statusFilter
      : undefined;

  const baseWhere = {
    channelId,
    ...searchWhere,
    ...(statusWhere
      ? {
          userStates: {
            some: { userId, status: statusWhere },
          },
        }
      : {}),
  };

  const [totalVideos, videos] = await Promise.all([
    prisma.video.count({ where: baseWhere }),
    prisma.video.findMany({
      where: baseWhere,
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        videoTags: {
          include: { tag: true },
          orderBy: { score: "desc" },
        },
        userStates: {
          where: { userId },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalVideos / PAGE_SIZE);

  const unwatchedCount = await prisma.video.count({
    where: {
      channelId,
      NOT: {
        userStates: {
          some: { userId, status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] } },
        },
      },
    },
  });

  const watchedCount = await prisma.video.count({
    where: {
      channelId,
      userStates: { some: { userId, status: "WATCHED" } },
    },
  });

  const notInterestedCount = await prisma.video.count({
    where: {
      channelId,
      userStates: { some: { userId, status: "NOT_INTERESTED" } },
    },
  });

  const counts = {
    all: totalVideos,
    unwatched: unwatchedCount,
    watched: watchedCount,
    notInterested: notInterestedCount,
  };

  const markAllAsWatched = markAllChannelVideosAsWatched.bind(null, channelId);

  function VideoList({ items }: { items: typeof videos }) {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          {query ? `No videos matching "${query}".` : "No videos found."}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((video) => {
            const currentStatus =
              (video.userStates[0]?.status as VideoStatus) || "UNWATCHED";
            return (
              <Card key={video.id} className="overflow-hidden group">
                <div className="aspect-video bg-muted relative">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <PlaySquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <VideoQuickToggle
                      videoId={video.id}
                      currentStatus={currentStatus}
                    />
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3
                      className="font-medium text-sm line-clamp-2"
                      title={video.title}
                    >
                      {video.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {video.category ? `${video.category} · ` : ""}
                      {new Date(video.publishedAt).toLocaleDateString()}
                      {video.durationSec ? (
                        <span className="ml-2">
                          {Math.floor(video.durationSec / 60)}:
                          {String(video.durationSec % 60).padStart(2, "0")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <VideoStatusToggle
                    videoId={video.id}
                    currentStatus={currentStatus}
                  />
                  <VideoTags videoId={video.id} tags={video.videoTags.map((vt) => ({ id: vt.tag.id, name: vt.tag.name, score: vt.score }))} />
                  <VideoTranscript
                    videoId={video.id}
                    transcript={video.transcript}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath={`/channels/${channelId}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{channel.title}</h1>
          <p className="text-muted-foreground mt-1">
            {counts.all} videos · {counts.unwatched} unwatched
            {channel.categories.length > 0 ? ` · ${channel.categories.map((c) => c.name).join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ChannelTranscriptFetch channelId={channelId} />
          <form action={syncChannelVideos.bind(null, channelId)}>
            <PendingButton variant="outline" size="sm" pendingText="Syncing...">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync videos
            </PendingButton>
          </form>
          <form action={markAllAsWatched}>
            <PendingButton
              variant="outline"
              size="sm"
              disabled={counts.unwatched === 0}
              pendingText="Marking..."
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark all as watched
            </PendingButton>
          </form>
        </div>
      </div>

      <ChannelCategoryManager
        channelId={channelId}
        categories={channel.categories}
        allCategories={await prisma.category.findMany({ orderBy: { name: "asc" } })}
      />

      <SearchInput placeholder="Search videos by title..." />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="unwatched">
            Unwatched ({counts.unwatched})
          </TabsTrigger>
          <TabsTrigger value="watched">Watched ({counts.watched})</TabsTrigger>
          <TabsTrigger value="not-interested">
            Not interested ({counts.notInterested})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <VideoList items={videos} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideoList
            channelId={channelId}
            userId={userId}
            status="UNWATCHED"
            page={page}
            query={query}
          />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideoList
            channelId={channelId}
            userId={userId}
            status="WATCHED"
            page={page}
            query={query}
          />
        </TabsContent>
        <TabsContent value="not-interested" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideoList
            channelId={channelId}
            userId={userId}
            status="NOT_INTERESTED"
            page={page}
            query={query}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function FilteredVideoList({
  channelId,
  userId,
  status,
  page,
  query,
}: {
  channelId: string;
  userId: string;
  status: VideoStatus;
  page: number;
  query?: string;
}) {
  const skip = (page - 1) * PAGE_SIZE;

  const searchWhere = query
    ? { title: { contains: query } }
    : {};

  const statusFilter =
    status === "UNWATCHED"
      ? {
          channelId,
          ...searchWhere,
          NOT: {
            userStates: {
              some: { userId, status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] } },
            },
          },
        }
      : {
          channelId,
          ...searchWhere,
          userStates: { some: { userId, status } },
        };

  const [total, videos] = await Promise.all([
    prisma.video.count({ where: statusFilter }),
    prisma.video.findMany({
      where: statusFilter,
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        videoTags: {
          include: { tag: true },
          orderBy: { score: "desc" },
        },
        userStates: { where: { userId } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {query ? `No videos matching "${query}".` : "No videos in this category."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden group">
            <div className="aspect-video bg-muted relative">
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <PlaySquare className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute top-2 right-2">
                <VideoQuickToggle videoId={video.id} currentStatus={status} />
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-medium text-sm line-clamp-2" title={video.title}>
                  {video.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {video.category ? `${video.category} · ` : ""}
                  {new Date(video.publishedAt).toLocaleDateString()}
                  {video.durationSec ? (
                    <span className="ml-2">
                      {Math.floor(video.durationSec / 60)}:
                      {String(video.durationSec % 60).padStart(2, "0")}
                    </span>
                  ) : null}
                </p>
              </div>
              <VideoStatusToggle videoId={video.id} currentStatus={status} />
              <VideoTags videoId={video.id} tags={video.videoTags.map((vt) => ({ id: vt.tag.id, name: vt.tag.name, score: vt.score }))} />
              <VideoTranscript
                videoId={video.id}
                transcript={video.transcript}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath={`/channels/${channelId}`} />
    </div>
  );
}
