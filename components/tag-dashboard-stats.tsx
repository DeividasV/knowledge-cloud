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
          <div className="space-y-2">
            {topTags.map((tag) => (
              <div
                key={tag.name}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-normal bg-secondary/30 shrink-0"
                  >
                    {tag.name}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {tag.avgScore.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                  {tag.watched > 0 && (
                    <span className="flex items-center gap-0.5 text-emerald-600">
                      <Eye className="h-3 w-3" />
                      {tag.watched}
                    </span>
                  )}
                  {tag.unwatched > 0 && (
                    <span className="flex items-center gap-0.5 text-slate-500">
                      <EyeOff className="h-3 w-3" />
                      {tag.unwatched}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
