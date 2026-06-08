import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoCard } from "@/components/video-card";
import { VideoStatus } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { AddVideoForm } from "@/components/add-video-form";
import { userVideosWhereWithCategory } from "@/lib/video-access";
import { searchVideos } from "@/lib/video-search";

const PAGE_SIZE = 50;

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    tab?: string;
    q?: string;
  }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;

  const {
    page: pageStr,
    status: statusLegacy,
    tab: tabRaw,
    q: query,
  } = await searchParams;

  // Map legacy status param to tab for backward compat
  const tab =
    tabRaw ||
    (statusLegacy && ["UNWATCHED", "WATCHED", "NOT_INTERESTED"].includes(statusLegacy)
      ? statusLegacy.toLowerCase().replace("_", "-")
      : "all");

  const page = Math.max(1, parseInt(pageStr || "1", 10));

  const isStandaloneTab = tab === "standalone";
  const baseWhereClause = await userVideosWhereWithCategory(userId);

  // Tab counts (without search filter)
  const [standaloneCount, statusCounts] = await Promise.all([
    prisma.video.count({
      where: {
        ...baseWhereClause,
        channelId: null,
      },
    }),
    prisma.userVideo.groupBy({
      by: ["status"],
      where: { userId },
      _count: { status: true },
    }),
  ]);

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

  // Fetch videos for the current tab with search + ranking
  const { videos, total: totalVideos } = await searchVideos({
    userId,
    query,
    tab,
    page,
  });

  const totalPages = Math.ceil(totalVideos / PAGE_SIZE);

  // Build return URL for video detail back-navigation
  const returnSearch = new URLSearchParams();
  if (pageStr && pageStr !== "1") returnSearch.set("page", pageStr);
  if (query) returnSearch.set("q", query);
  if (tab && tab !== "all") returnSearch.set("tab", tab);
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
            <VideoCard
              key={video.id}
              video={{
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
              }}
              href={`/videos/${video.id}?from=${encodeURIComponent(from)}`}
              subtitle={
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
              }
            />
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
          All videos from your subscribed channels and standalone additions. ({totalVideos} total)
        </p>
      </div>

      <AddVideoForm />
      <SearchInput placeholder="Search videos by title, description, transcript or tags..." />

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="all">All ({totalVideos})</TabsTrigger>
          <TabsTrigger value="unwatched">Unwatched ({counts.UNWATCHED})</TabsTrigger>
          <TabsTrigger value="watched">Watched ({counts.WATCHED})</TabsTrigger>
          <TabsTrigger value="not-interested">Not interested ({counts.NOT_INTERESTED})</TabsTrigger>
          <TabsTrigger value="standalone">Standalone ({standaloneCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <VideoList items={videos} from={returnUrl} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} tab="unwatched" page={page} query={query} from={returnUrl} />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} tab="watched" page={page} query={query} from={returnUrl} />
        </TabsContent>
        <TabsContent value="not-interested" className="mt-4">
          {/* @ts-ignore Next.js 16 async component JSX type bug */}
          <FilteredVideos userId={userId} tab="not-interested" page={page} query={query} from={returnUrl} />
        </TabsContent>
        <TabsContent value="standalone" className="mt-4">
          <VideoList items={videos} from={returnUrl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function FilteredVideos({
  userId,
  tab,
  page,
  query,
  from,
}: {
  userId: string;
  tab: string;
  page: number;
  query?: string;
  from: string;
}) {
  const { videos, total } = await searchVideos({
    userId,
    query,
    tab,
    page,
  });

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
          <VideoCard
            key={video.id}
            video={{
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
            }}
            href={`/videos/${video.id}?from=${encodeURIComponent(from)}`}
            subtitle={
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
            }
          />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/videos" />
    </div>
  );
}
