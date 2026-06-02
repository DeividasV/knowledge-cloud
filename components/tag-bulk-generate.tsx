"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  generateTagsBatch,
  getUntaggedVideoIds,
  getAllVideoIds,
} from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

const BATCH_SIZE = 5;

type Mode = "untagged" | "all";

export function TagBulkGenerate() {
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    isRunning: boolean;
    mode: Mode;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const router = useRouter();

  const runGenerate = useCallback(async (mode: Mode) => {
    setIsRunning(true);
    setProgress({ processed: 0, total: 0, isRunning: true, mode });

    try {
      const videoIds =
        mode === "untagged"
          ? await getUntaggedVideoIds(100)
          : await getAllVideoIds(100);

      const total = videoIds.length;
      if (total === 0) {
        setProgress({ processed: 0, total: 0, isRunning: false, mode });
        setIsRunning(false);
        return;
      }

      setProgress({ processed: 0, total, isRunning: true, mode });

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = videoIds.slice(i, i + BATCH_SIZE);
        await generateTagsBatch(batch);
        setProgress({ processed: Math.min(i + batch.length, total), total, isRunning: true, mode });
      }

      setProgress({ processed: total, total, isRunning: false, mode });
    } catch (e) {
      console.error("Batch tag generation failed:", e);
    } finally {
      setIsRunning(false);
      router.refresh();
    }
  }, [router]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => runGenerate("untagged")}
          disabled={isRunning}
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
          onClick={() => runGenerate("all")}
          disabled={isRunning}
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
