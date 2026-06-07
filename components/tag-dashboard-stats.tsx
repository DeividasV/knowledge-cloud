import Link from "next/link";
import { getTopTagsWithWatchStats, getTagScoreSummary } from "@/app/actions/videos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tag, Eye, EyeOff, Hash, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export async function TagDashboardStats() {
  const { totalTags, topTags } = await getTopTagsWithWatchStats(12);
  const tagSummary = await getTagScoreSummary();

  const tagTotal = tagSummary.totalScore;
  const tagWatchedPct =
    tagTotal > 0 ? Math.round((tagSummary.watchedScore / tagTotal) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Tag className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Tags</CardTitle>
            <p className="text-xs text-muted-foreground">
              {totalTags.toLocaleString()} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <div className="font-semibold tabular-nums">{tagTotal.toFixed(1)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums text-emerald-600">
                {tagSummary.watchedScore.toFixed(1)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Watched</div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums text-slate-500">
                {tagSummary.remainingScore.toFixed(1)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <div className="font-semibold tabular-nums text-emerald-600">
                {formatHours(tagSummary.watchedHours)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Watched</div>
            </div>
            <div className="text-right">
              <div className="font-semibold tabular-nums text-slate-500">
                {formatHours(tagSummary.remainingHours)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div>
            </div>
          </div>
          <div className="text-right min-w-[3rem]">
            <div className="font-semibold tabular-nums">{tagWatchedPct}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Done</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 pt-0">
        {/* Overall progress */}
        <div className="mb-4">
          <Progress value={tagWatchedPct} className="h-1.5" />
        </div>

        {topTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="space-y-1">
            {topTags.map((tag, index) => {
              const pct =
                tag.totalScore > 0
                  ? Math.round((tag.watchedScore / tag.totalScore) * 100)
                  : 0;

              const rank = index + 1;
              const isTop3 = rank <= 3;

              return (
                <div
                  key={tag.name}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2 py-2 transition-all",
                    "hover:bg-secondary/60 hover:shadow-sm"
                  )}
                >
                  {/* Rank */}
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums",
                      isTop3
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {rank}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link href={`/tags/${encodeURIComponent(tag.name)}`}>
                          <Badge
                            variant="outline"
                            className="text-[11px] px-2 py-0.5 font-medium bg-secondary/40 border-secondary shrink-0 cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                          >
                            {tag.name}
                          </Badge>
                        </Link>
                        <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                          Σ {tag.totalScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {tag.watchedCount}/{tag.totalCount} vids
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums w-8 text-right",
                            pct === 100
                              ? "text-emerald-600"
                              : pct >= 50
                              ? "text-amber-500"
                              : "text-slate-400"
                          )}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct === 100
                            ? "bg-emerald-500"
                            : pct >= 50
                            ? "bg-amber-400"
                            : "bg-slate-400"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Scores + hours */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1 text-emerald-600/80">
                        <Eye className="h-3 w-3" />
                        {tag.watchedScore.toFixed(2)}
                        <span className="text-emerald-600/60 ml-0.5">
                          <Clock className="h-3 w-3 inline -mt-px" />
                          {formatHours(tag.watchedHours)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <EyeOff className="h-3 w-3" />
                        {tag.remainingScore.toFixed(2)}
                        <span className="text-slate-400/60 ml-0.5">
                          <Clock className="h-3 w-3 inline -mt-px" />
                          {formatHours(tag.remainingHours)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
