import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlaySquare, Users, Trash2, Clock } from "lucide-react";
import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { AddChannelForm } from "@/components/add-channel-form";
import { removeChannel } from "@/app/actions/channels";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;
  const { q: query } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { selectedCategory: true },
  });
  const selectedCategory = user?.selectedCategory;

  const where = {
    users: { some: { id: userId } },
    ...(query ? { title: { contains: query } } : {}),
    ...(selectedCategory
      ? { categories: { some: { name: selectedCategory } } }
      : {}),
  };

  const channels = await prisma.channel.findMany({
    where,
    include: {
      _count: { select: { videos: true } },
      videos: {
        select: { id: true, durationSec: true },
      },
      categories: true,
    },
    orderBy: { title: "asc" },
  });

  const totalChannels = await prisma.channel.count({
    where: { users: { some: { id: userId } } },
  });

  // Bulk fetch related data
  const allVideoIds = channels.flatMap((c) => c.videos.map((v) => v.id));

  const [userVideos, videoTags] = await Promise.all([
    prisma.userVideo.findMany({
      where: { userId, videoId: { in: allVideoIds } },
      select: { videoId: true, status: true },
    }),
    prisma.videoTag.findMany({
      where: { videoId: { in: allVideoIds } },
      include: { tag: true },
    }),
  ]);

  const statusMap = new Map(userVideos.map((uv) => [uv.videoId, uv.status]));
  const videoToChannel = new Map<string, string>();
  for (const ch of channels) {
    for (const v of ch.videos) {
      videoToChannel.set(v.id, ch.id);
    }
  }

  // Aggregate stats per channel
  type ChannelStats = {
    totalDuration: number;
    watchedDuration: number;
    totalTagScore: number;
    watchedTagScore: number;
    watchedCount: number;
    unwatchedCount: number;
  };

  const statsMap = new Map<string, ChannelStats>();
  const topTagsMap = new Map<string, Map<string, number>>();

  for (const ch of channels) {
    statsMap.set(ch.id, {
      totalDuration: 0,
      watchedDuration: 0,
      totalTagScore: 0,
      watchedTagScore: 0,
      watchedCount: 0,
      unwatchedCount: 0,
    });
    topTagsMap.set(ch.id, new Map());
  }

  // Process videos for duration and watch counts
  for (const ch of channels) {
    const stats = statsMap.get(ch.id)!;
    for (const v of ch.videos) {
      const status = statusMap.get(v.id);
      const isWatched = status === "WATCHED";

      if (v.durationSec) {
        stats.totalDuration += v.durationSec;
        if (isWatched) stats.watchedDuration += v.durationSec;
      }

      if (isWatched) stats.watchedCount++;
      else if (!status || status === "UNWATCHED" || status === "WATCHING")
        stats.unwatchedCount++;
    }
  }

  // Process videoTags for scores and top tags
  for (const vt of videoTags) {
    const channelId = videoToChannel.get(vt.videoId);
    if (!channelId) continue;

    const stats = statsMap.get(channelId);
    if (stats) {
      stats.totalTagScore += vt.score;
      if (statusMap.get(vt.videoId) === "WATCHED") {
        stats.watchedTagScore += vt.score;
      }
    }

    const tagMap = topTagsMap.get(channelId);
    if (tagMap) {
      tagMap.set(vt.tag.name, (tagMap.get(vt.tag.name) || 0) + vt.score);
    }
  }

  const channelsWithStats = channels.map((ch) => {
    const stats = statsMap.get(ch.id)!;
    const tagMap = topTagsMap.get(ch.id)!;
    const topTags = Array.from(tagMap.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const watchedPct =
      ch._count.videos > 0
        ? Math.round((stats.watchedCount / ch._count.videos) * 100)
        : 0;

    return {
      ...ch,
      stats,
      topTags,
      watchedPct,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Channels</h1>
        <p className="text-muted-foreground mt-1">
          Your channels and their video counts. ({channels.length} of{" "}
          {totalChannels} shown)
          {selectedCategory && (
            <span className="ml-1 text-primary font-medium">
              · filtered by &quot;{selectedCategory}&quot;
            </span>
          )}
        </p>
      </div>

      <AddChannelForm />
      <SearchInput placeholder="Search channels by name..." />

      {channelsWithStats.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">
            {query || selectedCategory
              ? "No channels match your filters"
              : "No channels yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {query || selectedCategory
              ? "Try different search terms or change the category filter in the sidebar."
              : "Add a channel above to get started. Paste a YouTube channel URL, @handle, or channel ID."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {channelsWithStats.map((channel) => (
            <Card
              key={channel.id}
              className="overflow-hidden hover:shadow-md transition-shadow h-full group relative"
            >
              <Link href={`/channels/${channel.id}`} className="block">
                <div className="aspect-video bg-muted relative">
                  {channel.thumbnail ? (
                    <Image
                      src={channel.thumbnail}
                      alt={channel.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <PlaySquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3
                    className="font-medium truncate"
                    title={channel.title}
                  >
                    {channel.title}
                  </h3>

                  {/* Subscriber / video counts */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {channel.subscriberCount != null && (
                      <span>{formatNumber(channel.subscriberCount)} subs</span>
                    )}
                    {channel.videoCount != null && (
                      <span>{formatNumber(channel.videoCount)} videos</span>
                    )}
                  </div>

                  {/* Categories */}
                  {channel.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {channel.categories.map((cat) => (
                        <Badge
                          key={cat.id}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Top tags */}
                  {channel.topTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {channel.topTags.map((tag) => (
                        <Badge
                          key={tag.name}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {channel.stats.watchedCount}/{channel._count.videos}{" "}
                        watched
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(channel.stats.totalDuration)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          channel.watchedPct === 100
                            ? "bg-emerald-500"
                            : channel.watchedPct >= 50
                            ? "bg-blue-500"
                            : "bg-amber-500"
                        )}
                        style={{ width: `${channel.watchedPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Unwatched pill */}
                  {channel.stats.unwatchedCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {channel.stats.unwatchedCount} unwatched
                    </div>
                  )}
                </CardContent>
              </Link>
              <form
                action={removeChannel.bind(null, channel.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Button
                  size="sm"
                  variant="secondary"
                  type="submit"
                  className="h-7 w-7 p-0 bg-black/50 hover:bg-red-600 text-white border-0"
                  title="Unsubscribe from channel"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
