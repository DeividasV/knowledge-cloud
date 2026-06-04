import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaySquare, ArrowRight } from "lucide-react";
import Link from "next/link";
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

  // Build return URL for video detail back-navigation
  const returnSearch = new URLSearchParams();
  if (pageStr && pageStr !== "1") returnSearch.set("page", pageStr);
  if (query) returnSearch.set("q", query);
  if (statusFilter) returnSearch.set("status", statusFilter);
  const returnUrl = `/videos${returnSearch.toString() ? "?" + returnSearch.toString() : ""}`;

  function VideoList({ items, from }: { items: typeof videos; from: string }) {
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
              <Link href={`/videos/${video.id}?from=${encodeURIComponent(from)}`} className="block aspect-video bg-muted relative group/link">
                {video.thumbnail ? (
                  <>
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="h-full w-full object-cover transition-transform group-hover/link:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/link:bg-black/20 transition-colors flex items-center justify-center">
                      <ArrowRight className="h-6 w-6 text-white opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </div>
                  </>
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
              </Link>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Link href={`/videos/${video.id}?from=${encodeURIComponent(from)}`}>
                    <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors" title={video.title}>
                      {video.title}
                    </h3>
                  </Link>
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
                <VideoTags videoId={video.id} tags={video.videoTags.map((vt) => ({ id: vt.tag.id, name: vt.tag.name, score: vt.score }))} />
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
          <VideoList items={videos} from={returnUrl} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="UNWATCHED" page={page} query={query} from={returnUrl} />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="WATCHED" page={page} query={query} from={returnUrl} />
        </TabsContent>
        <TabsContent value="not-interested" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} status="NOT_INTERESTED" page={page} query={query} from={returnUrl} />
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
  from,
}: {
  userId: string;
  status: VideoStatus;
  page: number;
  query?: string;
  from: string;
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
            <Link href={`/videos/${video.id}?from=${encodeURIComponent(from)}`} className="block aspect-video bg-muted relative group/link">
              {video.thumbnail ? (
                <>
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform group-hover/link:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/link:bg-black/20 transition-colors flex items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-white opacity-0 group-hover/link:opacity-100 transition-opacity" />
                  </div>
                </>
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
            </Link>
            <CardContent className="p-4 space-y-3">
              <div>
                <Link href={`/videos/${video.id}?from=${encodeURIComponent(from)}`}>
                  <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors" title={video.title}>
                    {video.title}
                  </h3>
                </Link>
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
              <VideoTags videoId={video.id} tags={video.videoTags.map((vt) => ({ id: vt.tag.id, name: vt.tag.name, score: vt.score }))} />
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
