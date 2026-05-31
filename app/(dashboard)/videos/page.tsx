import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaySquare } from "lucide-react";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { VideoStatus } from "@/lib/types";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 50;

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;

  const { page: pageStr, status: statusFilter } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const statusWhere =
    statusFilter && ["UNWATCHED", "WATCHING", "WATCHED"].includes(statusFilter)
      ? statusFilter
      : undefined;

  const baseWhere = {
    channel: { users: { some: { id: userId } } },
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
    WATCHING: 0,
    WATCHED: 0,
  };
  for (const s of statusCounts) {
    counts[s.status as keyof typeof counts] = s._count.status;
  }

  function VideoList({ items }: { items: typeof videos }) {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          No videos found.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((video) => (
            <Card key={video.id} className="overflow-hidden">
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
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-medium text-sm line-clamp-2" title={video.title}>
                    {video.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.channel.title} · {new Date(video.publishedAt).toLocaleDateString()}
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

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({totalVideos})</TabsTrigger>
          <TabsTrigger value="unwatched">Unwatched ({counts.UNWATCHED})</TabsTrigger>
          <TabsTrigger value="watching">Watching ({counts.WATCHING})</TabsTrigger>
          <TabsTrigger value="watched">Watched ({counts.WATCHED})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <VideoList items={videos} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="UNWATCHED" page={page} />
        </TabsContent>
        <TabsContent value="watching" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="WATCHING" page={page} />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="WATCHED" page={page} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function FilteredVideos({
  userId,
  status,
  page,
}: {
  userId: string;
  status: VideoStatus;
  page: number;
}) {
  const skip = (page - 1) * PAGE_SIZE;

  const [total, videos] = await Promise.all([
    prisma.video.count({
      where: {
        channel: { users: { some: { id: userId } } },
        userStates: { some: { userId, status } },
      },
    }),
    prisma.video.findMany({
      where: {
        channel: { users: { some: { id: userId } } },
        userStates: { some: { userId, status } },
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        channel: true,
        userStates: { where: { userId } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No videos in this category.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden">
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
            </div>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-medium text-sm line-clamp-2" title={video.title}>
                  {video.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {video.channel.title} · {new Date(video.publishedAt).toLocaleDateString()}
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
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/videos" />
    </div>
  );
}
