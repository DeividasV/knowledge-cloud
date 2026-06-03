import { getDashboardStats } from "@/app/actions/videos";
import { TagDashboardStats } from "@/components/tag-dashboard-stats";
import { CategoryDashboard } from "@/components/category-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tv, PlaySquare, Eye, EyeOff, Ban, XCircle } from "lucide-react";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const actionableVideos = stats.totalVideos - stats.notInterested;
  const watchedPercent =
    actionableVideos > 0
      ? Math.round((stats.watched / actionableVideos) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your subscriptions, watch progress, and tags.
        </p>
      </div>

      {/* ── Stats row ───────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
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

      {/* ── Watch Progress + Top Tags ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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

        {/* @ts-ignore Next.js 16 async component JSX type bug */}
        <TagDashboardStats />
      </div>

      {/* ── Categories ──────────────────────────────────────────── */}
      {/* @ts-ignore Next.js 16 async component JSX type bug */}
      <CategoryDashboard />
    </div>
  );
}
