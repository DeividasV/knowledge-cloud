"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateVideoTags } from "@/app/actions/videos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagItem {
  id: string;
  name: string;
  score: number;
}

function getScoreColor(score: number, maxScore: number): string {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.85) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-blue-500";
  if (ratio >= 0.4) return "bg-amber-500";
  return "bg-slate-400";
}

function getScoreLabel(score: number, maxScore: number): string {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.85) return "High";
  if (ratio >= 0.6) return "Good";
  if (ratio >= 0.4) return "Moderate";
  return "Low";
}

export function TagReportClient({
  videoId,
  tags,
  tagCounts,
}: {
  videoId: string;
  tags: TagItem[];
  tagCounts?: Record<string, number>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const maxScore = tags[0]?.score ?? 0;

  const handleRegenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateVideoTags(videoId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {/* Score distribution mini-chart */}
      <div className="flex items-end gap-1 h-24 px-1">
        {tags.slice(0, 24).map((tag) => {
          const heightPercent =
            maxScore > 0 ? Math.max(8, (tag.score / maxScore) * 100) : 8;
          return (
            <div
              key={tag.id}
              className="flex-1 flex flex-col items-center gap-1 group"
              title={`${tag.name}: ${tag.score.toFixed(2)}`}
            >
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all min-w-[4px]",
                  getScoreColor(tag.score, maxScore)
                )}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Tag list with bars */}
      <div className="space-y-2">
        {tags.map((tag, idx) => {
          const barPercent = maxScore > 0 ? (tag.score / maxScore) * 100 : 0;
          const label = getScoreLabel(tag.score, maxScore);
          return (
            <div
              key={tag.id}
              className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
            >
              <span className="w-6 text-xs text-muted-foreground text-right tabular-nums">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <Link href={`/tags/${encodeURIComponent(tag.name)}`}>
                    <span className="text-sm font-medium truncate hover:text-primary hover:underline transition-colors cursor-pointer">
                      {tag.name}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {tagCounts && tagCounts[tag.id] !== undefined && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 font-normal inline-flex items-center gap-0.5"
                        title={`${tagCounts[tag.id]} other video${tagCounts[tag.id] === 1 ? "" : "s"} with this tag`}
                      >
                        <Hash className="h-2.5 w-2.5" />
                        {tagCounts[tag.id]}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 font-normal"
                    >
                      {label}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                      {tag.score.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      getScoreColor(tag.score, maxScore)
                    )}
                    style={{ width: `${barPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Regenerate */}
      <div className="flex flex-col items-end gap-2 pt-2">
        {error && (
          <p className="text-sm text-destructive text-right max-w-md">{error}</p>
        )}
        <Button
          onClick={handleRegenerate}
          disabled={isPending}
          variant="outline"
          size="sm"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          Regenerate tags
        </Button>
      </div>
    </div>
  );
}
