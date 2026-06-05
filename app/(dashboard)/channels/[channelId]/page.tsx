import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  RefreshCw,
  PlaySquare,
  Eye,
  EyeOff,
  XCircle,
  Tag,
  Clock,
  Hash,
} from "lucide-react";
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
import Link from "next/link";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

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
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    size?: string;
  }>;
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

  const searchWhere = query ? { title: { contains: query } } : {};

  const statusWhere =
    statusFilter &&
    ["UNWATCHED", "WATCHED", "NOT_INTERESTED"].includes(statusFilter)
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

  // Aggregate channel-wide stats
  const allVideos = await prisma.video.findMany({
    where: { channelId },
    select: {
      id: true,
      durationSec: true,
      userStates: {
        where: { userId },
        select: { status: true },
      },
      videoTags: {
        select: { score: true },
      },
    },
  });

  const allVideoTags = await prisma.videoTag.findMany({
    where: {
      video: { channelId },
    },
    include: { tag: true },
    orderBy: { score: "desc" },
  });

  let totalDuration = 0;
  let watchedDuration = 0;
  let totalTagScore = 0;
  let watchedTagScore = 0;
  let watchedCount = 0;
  let unwatchedCount = 0;
  let notInterestedCount = 0;

  for (const v of allVideos) {
    const status = v.userStates[0]?.status;
    const isWatched = status === "WATCHED";
    const isNotInterested = status === "NOT_INTERESTED";

    if (v.durationSec) {
      totalDuration += v.durationSec;
      if (isWatched) watchedDuration += v.durationSec;
    }

    for (const vt of v.videoTags) {
      totalTagScore += vt.score;
      if (isWatched) watchedTagScore += vt.score;
    }

    if (isWatched) watchedCount++;
    else if (isNotInterested) notInterestedCount++;
    else unwatchedCount++;
  }

  const tagMap = new Map<string, number>();
  for (const vt of allVideoTags) {
    tagMap.set(vt.tag.name, (tagMap.get(vt.tag.name) || 0) + vt.score);
  }
  const topTags = Array.from(tagMap.entries())
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const counts = {
    all: allVideos.length,
    unwatched: unwatchedCount,
    watched: watchedCount,
    notInterested: notInterestedCount,
  };

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

  const actionableVideos = counts.all - counts.notInterested;
  const watchedPct =
    actionableVideos > 0
      ? Math.round((counts.watched / actionableVideos) * 100)
      : 0;
  const scorePct =
    totalTagScore > 0
      ? Math.round((watchedTagScore / totalTagScore) * 100)
      : 0;

  // Build return URL for video detail back-navigation
  const returnSearch = new URLSearchParams();
  if (pageStr && pageStr !== "1") returnSearch.set("page", pageStr);
  if (query) returnSearch.set("q", query);
  if (statusFilter) returnSearch.set("status", statusFilter);
  if (sizeStr && sizeStr !== "50") returnSearch.set("size", sizeStr);
  const returnUrl = `/channels/${channelId}${returnSearch.toString() ? "?" + returnSearch.toString() : ""}`;

  const markAllAsWatched = markAllChannelVideosAsWatched.bind(null, channelId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {channel.title}
          </h1>
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
            untaggedCount={untaggedCount}
          />
          <ChannelTranscriptFetch
            channelId={channelId}
            videoCount={counts.all}
            missingCount={missingTranscriptCount}
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

      {/* Stats grid */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Videos" value={String(counts.all)} icon={PlaySquare} />
        <StatCard
          label="Watched"
          value={String(counts.watched)}
          icon={Eye}
          valueClass="text-emerald-600"
        />
        <StatCard
          label="Unwatched"
          value={String(counts.unwatched)}
          icon={EyeOff}
          valueClass="text-slate-500"
        />
        <StatCard
          label="Skipped"
          value={String(counts.notInterested)}
          icon={XCircle}
          valueClass="text-muted-foreground"
        />
        <StatCard
          label="Total Duration"
          value={formatDuration(totalDuration)}
          icon={Clock}
        />
        <StatCard
          label="Watched Duration"
          value={formatDuration(watchedDuration)}
          icon={Eye}
          valueClass="text-emerald-600"
        />
        <StatCard
          label="Total Score"
          value={totalTagScore.toFixed(1)}
          icon={Tag}
        />
        <StatCard
          label="Watched Score"
          value={watchedTagScore.toFixed(1)}
          icon={Eye}
          valueClass="text-emerald-600"
        />
      </div>

      {/* Progress bars */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Video completion</span>
              <span className="font-medium">{watchedPct}%</span>
            </div>
            <Progress value={watchedPct} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Score completion</span>
              <span className="font-medium">{scorePct}%</span>
            </div>
            <Progress value={scorePct} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Top tags */}
      {topTags.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Top Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {topTags.map((tag, idx) => (
                <Link
                  key={tag.name}
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-2 py-0.5 cursor-pointer hover:bg-primary/10 transition-colors",
                      idx < 3 && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <Hash className="h-3 w-3 mr-0.5 text-muted-foreground" />
                    {tag.name}
                    <span className="ml-1 text-muted-foreground text-[10px]">
                      {tag.score.toFixed(1)}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ChannelCategoryManager
        channelId={channelId}
        categories={channel.categories}
        allCategories={await prisma.category.findMany({
          orderBy: { name: "asc" },
        })}
      />

      <SearchInput placeholder="Search videos by title..." />

      <Tabs defaultValue="all">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="unwatched">
              Unwatched ({counts.unwatched})
            </TabsTrigger>
            <TabsTrigger value="watched">
              Watched ({counts.watched})
            </TabsTrigger>
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
            returnUrl={returnUrl}
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
            returnUrl={returnUrl}
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
            returnUrl={returnUrl}
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
            returnUrl={returnUrl}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className="text-lg font-bold tabular-nums truncate">
          <span className={valueClass}>{value}</span>
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
          <Icon className="h-3 w-3" />
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

async function FilteredVideoList({
  channelId,
  userId,
  status,
  page,
  query,
  pageSize,
  returnUrl,
}: {
  channelId: string;
  userId: string;
  status: VideoStatus;
  page: number;
  query?: string;
  pageSize: number;
  returnUrl: string;
}) {
  const skip = (page - 1) * pageSize;

  const searchWhere = query ? { title: { contains: query } } : {};

  const statusFilter =
    status === "UNWATCHED"
      ? {
          channelId,
          ...searchWhere,
          NOT: {
            userStates: {
              some: {
                userId,
                status: { in: ["WATCHING", "WATCHED", "NOT_INTERESTED"] },
              },
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
        {query
          ? `No videos matching "${query}".`
          : "No videos in this category."}
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
      returnUrl={returnUrl}
    />
  );
}
