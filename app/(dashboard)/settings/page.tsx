import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { syncSubscriptions, syncAllChannelsVideos, syncChannelVideos } from "@/app/actions/sync";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { YouTubeIcon } from "@/components/youtube-icon";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      channels: {
        orderBy: { title: "asc" },
      },
      _count: {
        select: { videoStates: true },
      },
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your sync settings and subscription data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <YouTubeIcon className="h-5 w-5" />
            YouTube Sync
          </CardTitle>
          <CardDescription>
            Fetch your latest subscriptions and videos from YouTube. Be mindful of API quota limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <form action={syncSubscriptions}>
              <Button type="submit">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Subscriptions
              </Button>
            </form>
            <form action={syncAllChannelsVideos}>
              <Button type="submit" variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All Videos
              </Button>
            </form>
          </div>

          {user.lastSyncAt && (
            <p className="text-sm text-muted-foreground">
              Last subscription sync: {new Date(user.lastSyncAt).toLocaleString()}
            </p>
          )}

          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Quota Notice</p>
              <p className="mt-1">
                YouTube Data API has a daily quota of ~10,000 units. Each sync consumes units based on
                your subscription count. Avoid excessive syncing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel Sync Status</CardTitle>
          <CardDescription>
            Individual channel video sync status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels synced yet.</p>
          ) : (
            user.channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{channel.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {channel.lastSyncedAt
                      ? `Last synced: ${new Date(channel.lastSyncedAt).toLocaleString()}`
                      : "Never synced"}
                  </p>
                </div>
                <form action={syncChannelVideos.bind(null, channel.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subscribed channels</span>
            <span className="font-medium">{user.channels.length}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Video status entries</span>
            <span className="font-medium">{user._count.videoStates}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
