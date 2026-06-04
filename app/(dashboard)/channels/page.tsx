import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlaySquare, Users } from "lucide-react";
import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { CategoryFilter } from "./channels-client";
import { AddChannelForm } from "@/components/add-channel-form";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;
  const { q: query, category: categoryFilter } = await searchParams;

  const where = {
    users: { some: { id: userId } },
    ...(query ? { title: { contains: query } } : {}),
    ...(categoryFilter
      ? { categories: { some: { name: categoryFilter } } }
      : {}),
  };

  const [channels, allCategories] = await Promise.all([
    prisma.channel.findMany({
      where,
      include: {
        _count: { select: { videos: true } },
        videos: { select: { id: true } },
        categories: true,
      },
      orderBy: { title: "asc" },
    }),
    prisma.category.findMany({
      where: { channels: { some: { users: { some: { id: userId } } } } },
      include: {
        _count: { select: { channels: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalChannels = await prisma.channel.count({
    where: { users: { some: { id: userId } } },
  });

  // Get unwatched counts per channel
  const videoIds = channels.flatMap((c) => c.videos.map((v) => v.id));
  const userVideos = await prisma.userVideo.findMany({
    where: { userId, videoId: { in: videoIds } },
    select: { videoId: true, status: true },
  });
  const statusMap = new Map(userVideos.map((uv) => [uv.videoId, uv.status]));

  const channelsWithCounts = channels.map((ch) => {
    const unwatched = ch.videos.filter(
      (v) => !statusMap.has(v.id) || statusMap.get(v.id) === "UNWATCHED"
    ).length;
    return { ...ch, unwatched };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Channels</h1>
        <p className="text-muted-foreground mt-1">
          Your channels and their video counts. ({channels.length} of {totalChannels} shown)
        </p>
      </div>

      <AddChannelForm />
      <SearchInput placeholder="Search channels by name..." />

      <CategoryFilter
        categories={allCategories.map((c) => ({
          id: c.id,
          name: c.name,
          count: c._count.channels,
        }))}
        totalChannels={totalChannels}
        currentCategory={categoryFilter || null}
      />

      {channelsWithCounts.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">
            {query || categoryFilter ? "No channels match your filters" : "No channels yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {query || categoryFilter
              ? "Try different search terms or clear the category filter."
              : "Add a channel above to get started. Paste a YouTube channel URL, @handle, or channel ID."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {channelsWithCounts.map((channel) => (
            <Link key={channel.id} href={`/channels/${channel.id}`}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="aspect-video bg-muted relative">
                  {channel.thumbnail ? (
                    <img
                      src={channel.thumbnail}
                      alt={channel.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <PlaySquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium truncate" title={channel.title}>
                    {channel.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {channel.categories.map((cat) => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="text-xs">
                      {channel._count.videos} videos
                    </Badge>
                    {channel.unwatched > 0 && (
                      <Badge variant="default" className="text-xs">
                        {channel.unwatched} unwatched
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
