"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateTagsForUntagged, getTagStats } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle, XCircle } from "lucide-react";

export function TagBulkGenerate() {
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    isRunning: boolean;
  } | null>(null);
  const router = useRouter();

  async function runGenerate() {
    setProgress({ processed: 0, total: 0, isRunning: true });

    const stats = await getTagStats();
    const totalToProcess = Math.min(stats.untaggedVideos, 100);

    if (totalToProcess === 0) {
      setProgress({ processed: 0, total: 0, isRunning: false });
      return;
    }

    setProgress({ processed: 0, total: totalToProcess, isRunning: true });

    const result = await generateTagsForUntagged(100);

    setProgress({
      processed: result.processed,
      total: totalToProcess,
      isRunning: false,
    });

    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => startTransition(runGenerate)}
        disabled={isPending || progress?.isRunning}
        variant="outline"
      >
        {progress?.isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {progress?.isRunning ? "Generating..." : "Generate tags for untagged videos"}
      </Button>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? "Processing..."
                : progress.total === 0
                ? "All videos already have tags!"
                : `Processed ${progress.processed} videos`}
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
