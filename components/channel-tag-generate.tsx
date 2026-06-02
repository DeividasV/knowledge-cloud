"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { generateTagsBatch, getChannelVideoIds } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle } from "lucide-react";

const BATCH_SIZE = 5;

export function ChannelTagGenerate({
  channelId,
  videoCount,
}: {
  channelId: string;
  videoCount: number;
}) {
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    isRunning: boolean;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const router = useRouter();

  const runGenerate = useCallback(async () => {
    setIsRunning(true);
    setProgress({ total: videoCount, done: 0, isRunning: true });

    try {
      const videoIds = await getChannelVideoIds(channelId);
      const total = videoIds.length;
      let done = 0;

      setProgress({ total, done: 0, isRunning: true });

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = videoIds.slice(i, i + BATCH_SIZE);
        await generateTagsBatch(batch);
        done += batch.length;
        setProgress({ total, done, isRunning: true });
      }

      setProgress({ total, done, isRunning: false });
    } catch (e) {
      console.error("Batch tag generation failed:", e);
    } finally {
      setIsRunning(false);
      router.refresh();
    }
  }, [channelId, videoCount, router]);

  if (videoCount === 0 && !progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="h-4 w-4 text-emerald-600" />
        No videos to tag
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={runGenerate}
        disabled={isRunning || videoCount === 0}
        variant="outline"
        size="sm"
      >
        {isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {isRunning
          ? `Regenerating ${progress?.done ?? 0}/${progress?.total ?? videoCount}...`
          : `Regenerate tags (${videoCount})`}
      </Button>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? `Processing videos...`
                : `Done! ${progress.done} videos processed`}
            </span>
            <span className="font-medium">
              {progress.total > 0
                ? `${Math.round((progress.done / progress.total) * 100)}%`
                : "100%"}
            </span>
          </div>

          {progress.total > 0 && (
            <Progress
              value={(progress.done / progress.total) * 100}
              className="h-2"
            />
          )}
        </div>
      )}
    </div>
  );
}
