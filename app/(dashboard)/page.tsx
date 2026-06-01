import { getDashboardStats, getRecentVideos } from "@/app/actions/videos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tv, PlaySquare, Eye, EyeOff, Ban, XCircle } from "lucide-react";
import { YouTubeIcon } from "@/components/youtube-icon";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { VideoStatus } from "@/lib/types";
import { VideoQuickToggle } from "@/components/video-quick-toggle";
import { VideoTranscript } from "@/components/video-transcript";
import { VideoTags } from "@/components/video-tags";

function StatusBadge({ status }: { status: VideoStatus }) {
  // Map legacy WATCHING to UNWATCHED for display
  const displayStatus = status === "WATCHING" ? "UNWATCHED" : status;
  const variants: Record<string, string> = {
    UNWATCHED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    WATCHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    NOT_INTERESTED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  const labels: Record<string, string> = {
    UNWATCHED: "Unwatched",
    WATCHED: "Watched",
    NOT_INTERESTED: "Not interested",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[displayStatus] || variants.UNWATCHED}`}>
      {labels[displayStatus] || "Unwatched"}
    </span>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const recentVideos = await getRecentVideos(12);

  const actionableVideos = stats.totalVideos - stats.notInterested;
  const watchedPercent =
    actionableVideos > 0
      ? Math.round((stats.watched / actionableVideos) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your YouTube subscriptions and watch progress.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Channels</CardTitle>
            <Tv className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChannels}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
            <PlaySquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVideos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unwatched</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unwatched}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Watched</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.watched}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Not Interested</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.notInterested}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Watch Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall completion</span>
            <span className="font-medium">{watchedPercent}%</span>
          </div>
          <Progress value={watchedPercent} className="h-2" />
          <div className="flex gap-4 pt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              {stats.unwatched} remaining
            </span>
            <span className="flex items-center gap-1">
              <Ban className="h-3 w-3" />
              {stats.notInterested} skipped
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Recent Videos</h2>
          <Link href="/videos" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View all
          </Link>
        </div>

        {recentVideos.length === 0 ? (
          <Card className="p-8 text-center">
            <YouTubeIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No videos yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Sync your subscriptions in Settings to start tracking videos.
            </p>
            <Link href="/settings" className={buttonVariants({ className: "mt-4" })}>
              Go to Settings
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentVideos.map((video) => (
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
                  <div className="absolute top-2 right-2">
                    <VideoQuickToggle
                      videoId={video.id}
                      currentStatus={
                        (video.userStates[0]?.status as VideoStatus) || "UNWATCHED"
                      }
                    />
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate text-sm" title={video.title}>
                        {video.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {video.channel.title}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <StatusBadge
                      status={
                        (video.userStates[0]?.status as VideoStatus) || "UNWATCHED"
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {new Date(video.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <VideoTags videoId={video.id} tags={video.tags} />
                  <VideoTranscript
                    videoId={video.id}
                    transcript={video.transcript}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
