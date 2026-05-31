import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaySquare } from "lucide-react";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { VideoStatus } from "@/lib/types";

export default async function VideosPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const videos = await prisma.video.findMany({
    where: { channel: { users: { some: { id: userId } } } },
    orderBy: { publishedAt: "desc" },
    include: {
      channel: true,
      userStates: {
        where: { userId },
      },
    },
  });

  const withStatus = videos.map((v) => ({
    ...v,
    status: (v.userStates[0]?.status as VideoStatus) || "UNWATCHED",
  }));

  const unwatched = withStatus.filter((v) => v.status === "UNWATCHED");
  const watching = withStatus.filter((v) => v.status === "WATCHING");
  const watched = withStatus.filter((v) => v.status === "WATCHED");

  function VideoList({ items }: { items: typeof withStatus }) {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          No videos found.
        </div>
      );
    }

    return (
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
              <VideoStatusToggle videoId={video.id} currentStatus={video.status} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
        <p className="text-muted-foreground mt-1">
          All videos from your subscribed channels.
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({withStatus.length})</TabsTrigger>
          <TabsTrigger value="unwatched">Unwatched ({unwatched.length})</TabsTrigger>
          <TabsTrigger value="watching">Watching ({watching.length})</TabsTrigger>
          <TabsTrigger value="watched">Watched ({watched.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <VideoList items={withStatus} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          <VideoList items={unwatched} />
        </TabsContent>
        <TabsContent value="watching" className="mt-4">
          <VideoList items={watching} />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          <VideoList items={watched} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
