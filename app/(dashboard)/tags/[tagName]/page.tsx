import { notFound } from "next/navigation";
import Link from "next/link";
import { getTagDetailByName } from "@/app/actions/tags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Tag,
  PlaySquare,
  Eye,
  EyeOff,
  XCircle,
  Hash,
} from "lucide-react";
import { VideoCard } from "@/components/video-card";
import { VideoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ tagName: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function TagDetailPage({ params, searchParams }: PageProps) {
  const { tagName: rawTagName } = await params;
  const tagName = decodeURIComponent(rawTagName);
  const detail = await getTagDetailByName(tagName);

  const returnUrl = `/tags/${encodeURIComponent(tagName)}`;

  if (!detail) notFound();

  const actionableVideos = detail.totalVideos - detail.notInterestedCount;
  const watchedPercent =
    actionableVideos > 0
      ? Math.round((detail.watchedCount / actionableVideos) * 100)
      : 0;

  const scorePct =
    detail.totalScore > 0
      ? Math.round((detail.watchedScore / detail.totalScore) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tag graph
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{detail.name}</h1>
            <p className="text-sm text-muted-foreground">
              {detail.totalVideos} video{detail.totalVideos !== 1 ? "s" : ""} · Σ{" "}
              {detail.totalScore.toFixed(2)}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-xs h-7 px-3",
            watchedPercent === 100
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700"
              : watchedPercent >= 50
              ? "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700"
              : "bg-slate-500/10 text-slate-700 border-slate-300 dark:text-slate-400 dark:border-slate-700"
          )}
        >
          {watchedPercent}% watched
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Total" value={String(detail.totalVideos)} icon={PlaySquare} />
        <StatCard
          label="Watched"
          value={String(detail.watchedCount)}
          icon={Eye}
          valueClass="text-emerald-600"
        />
        <StatCard
          label="Unwatched"
          value={String(detail.unwatchedCount)}
          icon={EyeOff}
          valueClass="text-slate-500"
        />
        <StatCard
          label="Skipped"
          value={String(detail.notInterestedCount)}
          icon={XCircle}
          valueClass="text-muted-foreground"
        />
        <StatCard
          label="Total Score"
          value={detail.totalScore.toFixed(1)}
          icon={Tag}
        />
        <StatCard
          label="Watched Score"
          value={detail.watchedScore.toFixed(1)}
          icon={Eye}
          valueClass="text-emerald-600"
        />
        <StatCard
          label="Remaining"
          value={detail.remainingScore.toFixed(1)}
          icon={EyeOff}
          valueClass="text-slate-500"
        />
      </div>

      {/* Progress bars */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Video completion</span>
              <span className="font-medium">{watchedPercent}%</span>
            </div>
            <Progress value={watchedPercent} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Score completion</span>
              <span className="font-medium">{scorePct}%</span>
            </div>
            <Progress value={scorePct} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Videos */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Videos</h2>
          {detail.videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos with this tag.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {detail.videos.map((video) => (
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
                    status: video.status as VideoStatus,
                  }}
                  href={`/videos/${video.id}?from=${encodeURIComponent(returnUrl)}`}
                  subtitle={
                    <>
                      {video.channel?.title ?? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Standalone
                        </span>
                      )}
                      · {new Date(video.publishedAt).toLocaleDateString()}
                      {video.durationSec ? (
                        <span className="ml-2">
                          {Math.floor(video.durationSec / 60)}:
                          {String(video.durationSec % 60).padStart(2, "0")}
                        </span>
                      ) : null}
                      <span className="ml-2 text-muted-foreground/70">
                        score {video.score.toFixed(2)}
                      </span>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Siblings sidebar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Related Tags</h2>
          {detail.siblings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No related tags.</p>
          ) : (
            <Card>
              <CardContent className="p-3 space-y-1">
                {detail.siblings.map((sibling, idx) => (
                  <Link
                    key={sibling.id}
                    href={`/tags/${encodeURIComponent(sibling.name)}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-secondary/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-4 text-right">
                        {idx + 1}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[11px] px-2 py-0.5 font-medium bg-secondary/40 border-secondary shrink-0"
                      >
                        {sibling.name}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      <Hash className="h-3 w-3" />
                      {sibling.sharedVideos}
                      <span className="text-muted-foreground/60">/ {sibling.totalVideos}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className="text-lg font-bold tabular-nums truncate">
          <span className={valueClass}>{value}</span>
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
          <Icon className="h-3 w-3" />
          {label}
        </div>
      </CardContent>
    </Card>
  );
}
