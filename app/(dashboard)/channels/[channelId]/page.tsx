import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, RefreshCw } from "lucide-react";
import { VideoStatus } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { markAllChannelVideosAsWatched } from "@/app/actions/videos";
import { syncChannelVideos } from "@/app/actions/sync";
import { PendingButton } from "@/components/pending-button";
import { ChannelCategoryManager } from "@/components/channel-category-manager";
import { ChannelTranscriptFetch } from "@/components/channel-transcript-fetch";
import { ChannelTagGenerate } from "@/components/channel-tag-generate";
import { ChannelVideoList } from "@/components/channel-video-list";
import { PageSizeSelector } from "@/components/page-size-selector";

function resolvePageSize(sizeStr?: string): number {
  const n = parseInt(sizeStr || "50", 10);
  if (n === 200 || n === 500) return n;
  return 50;
}

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ page?: string; status?: string; q?: string; size?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;

  const { channelId } = await params;
  const {
    page: pageStr,
    status: statusFilter,
    q: query,
    size: sizeStr,
  } = await searchParams;

  const pageSize = resolvePageSize(sizeStr);
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const skip = (page - 1) * pageSize;

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
      take: pageSize,
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

  const totalPages = Math.ceil(totalVideos / pageSize);

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

  const untaggedCount = await prisma.video.count({
    where: {
      channelId,
      videoTags: { none: {} },
    },
  });

  const missingTranscriptCount = await prisma.video.count({
    where: {
      channelId,
      transcript: null,
    },
  });

  const counts = {
    all: totalVideos,
    unwatched: unwatchedCount,
    watched: watchedCount,
    notInterested: notInterestedCount,
    untagged: untaggedCount,
    missingTranscripts: missingTranscriptCount,
  };

  const markAllAsWatched = markAllChannelVideosAsWatched.bind(null, channelId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{channel.title}</h1>
          <p className="text-muted-foreground mt-1">
            {counts.all} videos · {counts.unwatched} unwatched
            {channel.categories.length > 0
              ? ` · ${channel.categories.map((c) => c.name).join(", ")}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ChannelTagGenerate
            channelId={channelId}
            videoCount={counts.all}
            untaggedCount={counts.untagged}
          />
          <ChannelTranscriptFetch
            channelId={channelId}
            videoCount={counts.all}
            missingCount={counts.missingTranscripts}
          />
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
        <div className="flex items-center justify-between gap-4 flex-wrap">
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
          <PageSizeSelector />
        </div>

        <TabsContent value="all" className="mt-4">
          <ChannelVideoList
            channelId={channelId}
            videos={videos}
            page={page}
            totalPages={totalPages}
            query={query}
          />
        </TabsContent>

        <TabsContent value="unwatched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideoList
            channelId={channelId}
            userId={userId}
            status="UNWATCHED"
            page={page}
            query={query}
            pageSize={pageSize}
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
            pageSize={pageSize}
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
            pageSize={pageSize}
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
  pageSize,
}: {
  channelId: string;
  userId: string;
  status: VideoStatus;
  page: number;
  query?: string;
  pageSize: number;
}) {
  const skip = (page - 1) * pageSize;

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
      take: pageSize,
      include: {
        videoTags: {
          include: { tag: true },
          orderBy: { score: "desc" },
        },
        userStates: { where: { userId } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {query ? `No videos matching "${query}".` : "No videos in this category."}
      </div>
    );
  }

  return (
    <ChannelVideoList
      channelId={channelId}
      videos={videos}
      page={page}
      totalPages={totalPages}
      query={query}
    />
  );
}
