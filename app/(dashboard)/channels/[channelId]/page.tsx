import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaySquare, Users, ArrowLeft, CheckCheck } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { markAllChannelVideosAsWatched } from "@/app/actions/videos";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const session = await auth();
  const userId = session!.user!.id;

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      videos: {
        orderBy: { publishedAt: "desc" },
        include: {
          userStates: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!channel) {
    notFound();
    return null;
  }

  const totalVideos = channel.videos.length;
  const unwatched = channel.videos.filter(
    (v) => !v.userStates[0] || v.userStates[0].status === "UNWATCHED"
  );
  const watching = channel.videos.filter((v) => v.userStates[0]?.status === "WATCHING");
  const watched = channel.videos.filter((v) => v.userStates[0]?.status === "WATCHED");

  function VideoList({ videos }: { videos: any[] }) {
    if (videos.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          No videos in this category.
        </div>
      );
    }

    return (
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
        ))}
      </div>
    );
  }

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
          <TabsTrigger value="unwatched">Unwatched ({unwatched.length})</TabsTrigger>
          <TabsTrigger value="watching">Watching ({watching.length})</TabsTrigger>
          <TabsTrigger value="watched">Watched ({watched.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <VideoList videos={channel.videos} />
        </TabsContent>
        <TabsContent value="unwatched" className="mt-4">
          <VideoList videos={unwatched} />
        </TabsContent>
        <TabsContent value="watching" className="mt-4">
          <VideoList videos={watching} />
        </TabsContent>
        <TabsContent value="watched" className="mt-4">
          <VideoList videos={watched} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { VideoStatus } from "@/lib/types";
