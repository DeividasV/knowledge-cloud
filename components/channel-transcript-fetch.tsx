"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getChannelVideosWithoutTranscript,
  fetchTranscriptsBatch,
} from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Loader2, CheckCircle, XCircle } from "lucide-react";

const BATCH_SIZE = 10;

export function ChannelTranscriptFetch({ channelId }: { channelId: string }) {
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [loadingIds, setLoadingIds] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    successes: number;
    errors: number;
    unavailable: number;
    isRunning: boolean;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLoadingIds(true);
    getChannelVideosWithoutTranscript(channelId).then((ids) => {
      setVideoIds(ids);
      setLoadingIds(false);
    });
  }, [channelId]);

  async function runFetch() {
    setProgress({
      total: videoIds.length,
      done: 0,
      successes: 0,
      errors: 0,
      unavailable: 0,
      isRunning: true,
    });

    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      const batch = videoIds.slice(i, i + BATCH_SIZE);
      const results = await fetchTranscriptsBatch(batch);

      const successes = results.filter((r) => r.status === "success").length;
      const errors = results.filter((r) => r.status === "error").length;
      const unavailable = results.filter((r) => r.status === "unavailable").length;

      setProgress((prev) =>
        prev
          ? {
              ...prev,
              done: prev.done + batch.length,
              successes: prev.successes + successes,
              errors: prev.errors + errors,
              unavailable: prev.unavailable + unavailable,
            }
          : null
      );
    }

    setProgress((prev) => (prev ? { ...prev, isRunning: false } : null));
    // Refresh videoIds after fetching
    const remaining = await getChannelVideosWithoutTranscript(channelId);
    setVideoIds(remaining);
    router.refresh();
  }

  if (loadingIds) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (videoIds.length === 0 && !progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="h-4 w-4 text-emerald-600" />
        All transcripts fetched
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => startTransition(runFetch)}
        disabled={isPending || progress?.isRunning || videoIds.length === 0}
        variant="outline"
        size="sm"
      >
        {progress?.isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        {progress?.isRunning
          ? "Fetching..."
          : `Fetch transcripts (${videoIds.length})`}
      </Button>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? `Fetching ${progress.done + 1} of ${progress.total}`
                : `Fetched ${progress.done} videos`}
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

          {progress.done > 0 && (
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="h-3 w-3" />
                {progress.successes} OK
              </span>
              {progress.unavailable > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <FileText className="h-3 w-3" />
                  {progress.unavailable} no captions
                </span>
              )}
              {progress.errors > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-3 w-3" />
                  {progress.errors} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
