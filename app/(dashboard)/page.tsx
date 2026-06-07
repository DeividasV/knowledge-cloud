import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/app/actions/videos";
import { TagDashboardStats } from "@/components/tag-dashboard-stats";
import { CategoryDashboard } from "@/components/category-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tv, PlaySquare, Eye, EyeOff, XCircle, Clock } from "lucide-react";

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [stats, user] = await Promise.all([
    getDashboardStats(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { selectedCategory: true },
    }),
  ]);

  const selectedCategory = user?.selectedCategory;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your subscriptions, watch progress, and tags.
          {selectedCategory && (
            <span className="ml-1 text-primary font-medium">
              · filtered by &quot;{selectedCategory}&quot;
            </span>
          )}
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
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatHours(stats.unwatchedHours)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Watched</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.watched}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatHours(stats.watchedHours)}
            </p>
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

      {/* ── Tags ────────────────────────── */}
      <div className="grid gap-4">
        {/* @ts-ignore Next.js 16 async component JSX type bug */}
        <TagDashboardStats />
      </div>

      {/* ── Categories ──────────────────────────────────────────── */}
      {/* @ts-ignore Next.js 16 async component JSX type bug */}
      <CategoryDashboard />
    </div>
  );
}
