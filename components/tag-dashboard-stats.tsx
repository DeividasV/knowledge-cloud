import { getTopTagsWithWatchStats } from "@/app/actions/videos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, Eye, EyeOff } from "lucide-react";

export async function TagDashboardStats() {
  const { totalTags, topTags } = await getTopTagsWithWatchStats(10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Top Tags ({totalTags} total)
        </CardTitle>
        <Tag className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {topTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="space-y-2.5">
            {topTags.map((tag) => {
              const pct =
                tag.totalScore > 0
                  ? Math.round((tag.watchedScore / tag.totalScore) * 100)
                  : 0;

              return (
                <div key={tag.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal bg-secondary/30 shrink-0"
                      >
                        {tag.name}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        Σ {tag.totalScore.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium tabular-nums shrink-0">
                      {pct}%
                    </span>
                  </div>

                  {/* Score-weighted progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Eye className="h-3 w-3" />
                      {tag.watchedScore.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <EyeOff className="h-3 w-3" />
                      {tag.remainingScore.toFixed(2)}
                    </span>
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
