import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaySquare, ArrowLeft, CheckCheck } from "lucide-react";
import Link from "next/link";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { markAllChannelVideosAsWatched } from "@/app/actions/videos";
import { VideoStatus } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";

const PAGE_SIZE = 50;

export default async function ChannelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string | undefined }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await params;
  const cid = p.channelId;
  if (!cid) {
    notFound();
    return null;
  }
  const channelId = cid;

  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));

  const session = await auth();
  const userId = session!.user!.id;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel) {
    notFound();
    return null;
  }

  const skip = (page - 1) * PAGE_SIZE;

  const [totalVideos, videos] = await Promise.all([
    prisma.video.count({ where: { channelId: channelId } }),
    prisma.video.findMany({
      where: { channelId: channelId },
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
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
          some: { userId, status: { in: ["WATCHING", "WATCHED"] } },
        },
      },
    },
  });

  const watchingCount = await prisma.video.count({
    where: {
      channelId,
      userStates: { some: { userId, status: "WATCHING" } },
    },
  });

  const watchedCount = await prisma.video.count({
    where: {
      channelId,
      userStates: { some: { userId, status: "WATCHED" } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/channels" className={buttonVariants({ variant: "outline", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{channel.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{totalVideos} videos</Badge>
            {channel.subscriberCount && (
              <Badge variant="outline">
                {Intl.NumberFormat().format(channel.subscriberCount)} subscribers
              </Badge>
            )}
          </div>
        </div>
        <form action={markAllChannelVideosAsWatched.bind(null, channelId)}>
          <Button type="submit" variant="outline" size="sm">
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all watched
          </Button>
        </form>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({totalVideos})</TabsTrigger>
          <TabsTrigger value="unwatched">Unwatched ({unwatchedCount})</TabsTrigger>
          <TabsTrigger value="watching">Watching ({watchingCount})</TabsTrigger>
          <TabsTrigger value="watched">Watched ({watchedCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {/* @ts-ignore Next.js 16 type bug with route params in JSX */}
          <VideoList videos={videos} totalPages={totalPages} page={page} channelId={channelId} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          {/* @ts-ignore Next.js 16 type bug with route params in JSX */}
          <FilteredVideoList channelId={channelId} userId={userId} status="UNWATCHED" page={page} />
        </TabsContent>
        <TabsContent value="watching" className="mt-4">
          {/* @ts-ignore Next.js 16 type bug with route params in JSX */}
          <FilteredVideoList channelId={channelId} userId={userId} status="WATCHING" page={page} />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          {/* @ts-ignore Next.js 16 type bug with route params in JSX */}
          <FilteredVideoList channelId={channelId} userId={userId} status="WATCHED" page={page} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VideoList({
  videos,
  totalPages,
  page,
  channelId,
}: {
  videos: any[];
  totalPages: number;
  page: number;
  channelId: string;
}) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">No videos found.</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath={`/channels/${channelId}`} />
    </div>
  );
}

async function FilteredVideoList({
  channelId,
  userId,
  status,
  page,
}: {
  channelId: string;
  userId: string;
  status: VideoStatus;
  page: number;
}) {
  const skip = (page - 1) * PAGE_SIZE;

  const statusFilter =
    status === "UNWATCHED"
      ? {
          channelId,
          NOT: {
            userStates: {
              some: { userId, status: { in: ["WATCHING", "WATCHED"] } },
            },
          },
        }
      : {
          channelId,
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
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath={`/channels/${channelId}`} />
    </div>
  );
}

function VideoCard({ video }: { video: any }) {
  return (
    <Card className="overflow-hidden">
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
          currentStatus={
            (video.userStates[0]?.status as VideoStatus) || "UNWATCHED"
          }
        />
      </CardContent>
    </Card>
  );
}
