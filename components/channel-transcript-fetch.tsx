"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getChannelVideoIds,
  getChannelVideosWithoutTranscript,
  fetchTranscriptsBatch,
} from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Loader2, CheckCircle, XCircle, ChevronDown, RefreshCw } from "lucide-react";

const BATCH_SIZE = 10;

type Mode = "all" | "missing";

const MODE_LABELS: Record<Mode, string> = {
  all: "Fetch all",
  missing: "Fetch missing",
};

export function ChannelTranscriptFetch({
  channelId,
  videoCount,
  missingCount,
}: {
  channelId: string;
  videoCount: number;
  missingCount: number;
}) {
  const [mode, setMode] = useState<Mode>("missing");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    successes: number;
    errors: number;
    unavailable: number;
    isRunning: boolean;
  } | null>(null);
  const router = useRouter();

  const displayCount = mode === "all" ? videoCount : missingCount;

  const runFetch = useCallback(async () => {
    setIsRunning(true);
    setProgress({
      total: displayCount,
      done: 0,
      successes: 0,
      errors: 0,
      unavailable: 0,
      isRunning: true,
    });

    try {
      const videoIds =
        mode === "all"
          ? await getChannelVideoIds(channelId)
          : await getChannelVideosWithoutTranscript(channelId);

      const total = videoIds.length;
      if (total === 0) {
        setProgress({ total: 0, done: 0, successes: 0, errors: 0, unavailable: 0, isRunning: false });
        setIsRunning(false);
        return;
      }

      setProgress({ total, done: 0, successes: 0, errors: 0, unavailable: 0, isRunning: true });

      for (let i = 0; i < total; i += BATCH_SIZE) {
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
      router.refresh();
    } catch (e) {
      console.error("Batch transcript fetch failed:", e);
    } finally {
      setIsRunning(false);
    }
  }, [channelId, mode, displayCount, router]);

  if (videoCount === 0 && !progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="h-4 w-4 text-emerald-600" />
        No videos
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-0">
        <Button
          onClick={runFetch}
          disabled={isRunning || displayCount === 0}
          variant="outline"
          size="sm"
          className="rounded-r-none"
        >
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : mode === "all" ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          {isRunning
            ? `${progress?.done ?? 0}/${progress?.total ?? displayCount}`
            : `${MODE_LABELS[mode]} (${displayCount})`}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isRunning}
            className="inline-flex items-center justify-center rounded-r-md rounded-l-none border border-input bg-background px-2 text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border-l-0 cursor-pointer h-9"
          >
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setMode("all")}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Fetch all transcripts ({videoCount})</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode("missing")}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Fetch missing transcripts ({missingCount})</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? `Fetching ${mode === "all" ? "all videos" : "missing transcripts"}...`
                : progress.total === 0
                ? "No videos to fetch!"
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
