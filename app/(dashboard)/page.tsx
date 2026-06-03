import { getDashboardStats, getTagScoreSummary } from "@/app/actions/videos";
import { TagDashboardStats } from "@/components/tag-dashboard-stats";
import { CategoryDashboard } from "@/components/category-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tv, PlaySquare, Eye, EyeOff, Ban, XCircle, Tag } from "lucide-react";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const tagSummary = await getTagScoreSummary();

  const actionableVideos = stats.totalVideos - stats.notInterested;
  const watchedPercent =
    actionableVideos > 0
      ? Math.round((stats.watched / actionableVideos) * 100)
      : 0;

  const tagTotal = tagSummary.totalScore;
  const tagWatchedPct =
    tagTotal > 0 ? Math.round((tagSummary.watchedScore / tagTotal) * 100) : 0;

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

      {/* ── Tag score summary + Top Tags ────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Global tag score card */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tag Score</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold tabular-nums">
                  {tagTotal.toFixed(1)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Total
                </div>
              </div>
              <div>
                <div className="text-lg font-bold tabular-nums text-emerald-600">
                  {tagSummary.watchedScore.toFixed(1)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Watched
                </div>
              </div>
              <div>
                <div className="text-lg font-bold tabular-nums text-slate-500">
                  {tagSummary.remainingScore.toFixed(1)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Remaining
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium">{tagWatchedPct}%</span>
              </div>
              <Progress value={tagWatchedPct} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* @ts-ignore Next.js 16 async component JSX type bug */}
        <TagDashboardStats />

        {/* Watch Progress */}
        <Card className="lg:col-span-1">
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
      </div>

      {/* ── Categories ──────────────────────────────────────────── */}
      {/* @ts-ignore Next.js 16 async component JSX type bug */}
      <CategoryDashboard />
    </div>
  );
}
