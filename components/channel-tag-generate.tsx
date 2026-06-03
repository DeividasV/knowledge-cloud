"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  generateTagsBatch,
  getChannelVideoIds,
  getChannelUntaggedVideoIds,
} from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Loader2, CheckCircle, RefreshCw, ChevronDown } from "lucide-react";

const BATCH_SIZE = 5;

type Mode = "all" | "untagged";

const MODE_LABELS: Record<Mode, string> = {
  all: "Regenerate all",
  untagged: "Generate missing",
};

export function ChannelTagGenerate({
  channelId,
  videoCount,
  untaggedCount,
}: {
  channelId: string;
  videoCount: number;
  untaggedCount: number;
}) {
  const [mode, setMode] = useState<Mode>("untagged");
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    isRunning: boolean;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const router = useRouter();

  const displayCount = mode === "all" ? videoCount : untaggedCount;

  const runGenerate = useCallback(async () => {
    setIsRunning(true);
    setProgress({ total: displayCount, done: 0, isRunning: true });

    try {
      const videoIds =
        mode === "all"
          ? await getChannelVideoIds(channelId)
          : await getChannelUntaggedVideoIds(channelId);

      const total = videoIds.length;
      let done = 0;

      if (total === 0) {
        setProgress({ total: 0, done: 0, isRunning: false });
        setIsRunning(false);
        return;
      }

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
  }, [channelId, mode, displayCount, router]);

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
      <div className="flex items-center gap-0">
        <Button
          onClick={runGenerate}
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
            <Sparkles className="mr-2 h-4 w-4" />
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
              <span>Regenerate all ({videoCount})</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode("untagged")}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Generate missing ({untaggedCount})</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? `Processing ${mode === "all" ? "all videos" : "untagged videos"}...`
                : progress.total === 0
                ? "No videos to process!"
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
