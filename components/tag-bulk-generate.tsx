"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateTagsForUntagged,
  generateTagsForAll,
  getTagStats,
} from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

type Mode = "untagged" | "all";

export function TagBulkGenerate() {
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    isRunning: boolean;
    mode: Mode;
  } | null>(null);
  const router = useRouter();

  async function runGenerate(mode: Mode) {
    setProgress({ processed: 0, total: 0, isRunning: true, mode });

    const stats = await getTagStats();
    const totalToProcess =
      mode === "untagged"
        ? Math.min(stats.untaggedVideos, 100)
        : Math.min(stats.taggedVideos + stats.untaggedVideos, 100);

    if (totalToProcess === 0) {
      setProgress({ processed: 0, total: 0, isRunning: false, mode });
      return;
    }

    setProgress({ processed: 0, total: totalToProcess, isRunning: true, mode });

    const result =
      mode === "untagged"
        ? await generateTagsForUntagged(100)
        : await generateTagsForAll(100);

    setProgress({
      processed: result.processed,
      total: totalToProcess,
      isRunning: false,
      mode,
    });

    router.refresh();
  }

  const isRunning = progress?.isRunning ?? false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => startTransition(() => runGenerate("untagged"))}
          disabled={isPending || isRunning}
          variant="outline"
        >
          {isRunning && progress?.mode === "untagged" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate for untagged
        </Button>

        <Button
          onClick={() => startTransition(() => runGenerate("all"))}
          disabled={isPending || isRunning}
          variant="outline"
        >
          {isRunning && progress?.mode === "all" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Regenerate all
        </Button>
      </div>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? `Processing ${progress.mode === "all" ? "all videos" : "untagged videos"}...`
                : progress.total === 0
                ? "No videos to process!"
                : `Processed ${progress.processed} ${progress.mode === "all" ? "videos" : "untagged videos"}`}
            </span>
            <span className="font-medium">
              {progress.total > 0
                ? `${Math.round((progress.processed / progress.total) * 100)}%`
                : "100%"}
            </span>
          </div>

          {progress.total > 0 && (
            <Progress
              value={(progress.processed / progress.total) * 100}
              className="h-2"
            />
          )}
        </div>
      )}
    </div>
  );
}
