"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateTagsForChannel } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle } from "lucide-react";

export function ChannelTagGenerate({
  channelId,
  videoCount,
}: {
  channelId: string;
  videoCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    isRunning: boolean;
  } | null>(null);
  const router = useRouter();

  async function runGenerate() {
    setProgress({ total: videoCount, done: 0, isRunning: true });

    const result = await generateTagsForChannel(channelId);

    setProgress({
      total: result.processed,
      done: result.processed,
      isRunning: false,
    });

    router.refresh();
  }

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
        onClick={() => startTransition(runGenerate)}
        disabled={isPending || progress?.isRunning || videoCount === 0}
        variant="outline"
        size="sm"
      >
        {progress?.isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {progress?.isRunning
          ? "Regenerating..."
          : `Regenerate tags (${videoCount})`}
      </Button>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? "Regenerating tags..."
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
