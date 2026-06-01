import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaySquare } from "lucide-react";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { VideoQuickToggle } from "@/components/video-quick-toggle";
import { VideoTranscript } from "@/components/video-transcript";
import { VideoTags } from "@/components/video-tags";
import { VideoStatus } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";

const PAGE_SIZE = 50;

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;

  const { page: pageStr, status: statusFilter, q: query } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const searchWhere = query
    ? {
        title: { contains: query },
      }
    : {};

  const statusWhere =
    statusFilter && ["UNWATCHED", "WATCHED", "NOT_INTERESTED"].includes(statusFilter)
      ? statusFilter
      : undefined;

  const baseWhere = {
    channel: { users: { some: { id: userId } } },
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
        channel: true,
        tags: true,
        userStates: {
          where: { userId },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalVideos / PAGE_SIZE);

  const statusCounts = await prisma.userVideo.groupBy({
    by: ["status"],
    where: { userId },
    _count: { status: true },
  });

  const counts = {
    UNWATCHED: 0,
    WATCHED: 0,
    NOT_INTERESTED: 0,
  };
  for (const s of statusCounts) {
    const key = s.status as keyof typeof counts;
    if (key in counts) {
      counts[key] = s._count.status;
    }
  }

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
          {items.map((video) => (
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
                    currentStatus={
                      (video.userStates[0]?.status as VideoStatus) || "UNWATCHED"
                    }
                  />
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-medium text-sm line-clamp-2" title={video.title}>
                    {video.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.channel.title}
                    {video.category ? ` · ${video.category}` : ""}
                    · {new Date(video.publishedAt).toLocaleDateString()}
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
                  currentStatus={
                    (video.userStates[0]?.status as VideoStatus) || "UNWATCHED"
                  }
                />
                <VideoTags videoId={video.id} tags={video.tags} />
                <VideoTranscript
                  videoId={video.id}
                  transcript={video.transcript}
                />
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/videos" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
        <p className="text-muted-foreground mt-1">
          All videos from your subscribed channels. ({totalVideos} total)
        </p>
      </div>

      <SearchInput placeholder="Search videos by title..." />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({totalVideos})</TabsTrigger>
          <TabsTrigger value="unwatched">Unwatched ({counts.UNWATCHED})</TabsTrigger>
          <TabsTrigger value="watched">Watched ({counts.WATCHED})</TabsTrigger>
          <TabsTrigger value="not-interested">Not interested ({counts.NOT_INTERESTED})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <VideoList items={videos} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="UNWATCHED" page={page} query={query} />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="WATCHED" page={page} query={query} />
        </TabsContent>
        <TabsContent value="not-interested" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="NOT_INTERESTED" page={page} query={query} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function FilteredVideos({
  userId,
  status,
  page,
  query,
}: {
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
          channel: { users: { some: { id: userId } } },
          ...searchWhere,
          NOT: {
            userStates: {
              some: { userId, status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] } },
            },
          },
        }
      : {
          channel: { users: { some: { id: userId } } },
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
        channel: true,
        tags: true,
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
                <VideoQuickToggle
                  videoId={video.id}
                  currentStatus={status}
                />
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-medium text-sm line-clamp-2" title={video.title}>
                  {video.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {video.channel.title}
                  {video.category ? ` · ${video.category}` : ""}
                  · {new Date(video.publishedAt).toLocaleDateString()}
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
                currentStatus={status}
              />
              <VideoTags videoId={video.id} tags={video.tags} />
              <VideoTranscript
                videoId={video.id}
                transcript={video.transcript}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/videos" />
    </div>
  );
}
