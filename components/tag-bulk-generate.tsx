"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  generateTagsBatch,
  getUntaggedVideoIds,
  getAllVideoIds,
  setTagBatchModeSetting,
} from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Loader2, RefreshCw, ChevronDown, CheckIcon } from "lucide-react";

const BATCH_SIZE = 5;

type Mode = "untagged" | "all";

const MODE_LABELS: Record<Mode, string> = {
  untagged: "Generate for untagged",
  all: "Regenerate all",
};

const MODE_ICONS: Record<Mode, typeof Sparkles> = {
  untagged: Sparkles,
  all: RefreshCw,
};

export function TagBulkGenerate({ initialMode }: { initialMode: string }) {
  const [mode, setMode] = useState<Mode>(initialMode === "all" ? "all" : "untagged");
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    isRunning: boolean;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const router = useRouter();

  const handleModeChange = useCallback(
    async (newMode: Mode) => {
      setMode(newMode);
      await setTagBatchModeSetting(newMode);
      router.refresh();
    },
    [router]
  );

  const runGenerate = useCallback(async () => {
    setIsRunning(true);
    setProgress({ processed: 0, total: 0, isRunning: true });

    try {
      const videoIds =
        mode === "untagged"
          ? await getUntaggedVideoIds(100)
          : await getAllVideoIds(100);

      const total = videoIds.length;
      if (total === 0) {
        setProgress({ processed: 0, total: 0, isRunning: false });
        setIsRunning(false);
        return;
      }

      setProgress({ processed: 0, total, isRunning: true });

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = videoIds.slice(i, i + BATCH_SIZE);
        await generateTagsBatch(batch);
        setProgress({
          processed: Math.min(i + batch.length, total),
          total,
          isRunning: true,
        });
      }

      setProgress({ processed: total, total, isRunning: false });
    } catch (e) {
      console.error("Batch tag generation failed:", e);
    } finally {
      setIsRunning(false);
      router.refresh();
    }
  }, [mode, router]);

  const Icon = MODE_ICONS[mode];
  const label = MODE_LABELS[mode];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={runGenerate}
          disabled={isRunning}
          variant="default"
          className="rounded-r-none"
        >
          {isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Icon className="mr-2 h-4 w-4" />
          )}
          {label}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isRunning}
            className="inline-flex items-center justify-center rounded-r-md rounded-l-none bg-primary px-2 text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border-l border-primary-foreground/20 cursor-pointer"
          >
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleModeChange("untagged")}>
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Generate for untagged</span>
              {mode === "untagged" && (
                <CheckIcon className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleModeChange("all")}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Regenerate all</span>
              {mode === "all" && (
                <CheckIcon className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? mode === "all"
                  ? "Regenerating all videos..."
                  : "Generating tags for untagged videos..."
                : progress.total === 0
                ? "No videos to process!"
                : `Processed ${progress.processed} ${mode === "all" ? "videos" : "untagged videos"}`}
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
