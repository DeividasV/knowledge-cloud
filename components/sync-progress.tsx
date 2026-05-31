"use client";

import { useState, useTransition } from "react";
import { getChannelsNeedingSync, syncChannelsBatch } from "@/app/actions/sync";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";

const BATCH_SIZE = 5;

export function SyncProgressButton() {
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    successes: number;
    errors: number;
    currentChannel: string;
    isRunning: boolean;
  } | null>(null);

  async function runSync() {
    setProgress({
      total: 0,
      done: 0,
      successes: 0,
      errors: 0,
      currentChannel: "Loading channels...",
      isRunning: true,
    });

    const channels = await getChannelsNeedingSync(24);

    if (channels.length === 0) {
      setProgress({
        total: 0,
        done: 0,
        successes: 0,
        errors: 0,
        currentChannel: "All channels are up to date!",
        isRunning: false,
      });
      return;
    }

    setProgress({
      total: channels.length,
      done: 0,
      successes: 0,
      errors: 0,
      currentChannel: "Starting...",
      isRunning: true,
    });

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, i + BATCH_SIZE);
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              currentChannel: batch.map((c) => c.title).join(", "),
            }
          : null
      );

      const results = await syncChannelsBatch(batch.map((c) => c.id));

      const successes = results.filter((r) => r.status === "success").length;
      const errors = results.filter((r) => r.status === "error").length;

      setProgress((prev) =>
        prev
          ? {
              ...prev,
              done: prev.done + batch.length,
              successes: prev.successes + successes,
              errors: prev.errors + errors,
            }
          : null
      );
    }

    setProgress((prev) =>
      prev
        ? {
            ...prev,
            currentChannel: "Done!",
            isRunning: false,
          }
        : null
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => startTransition(runSync)}
        disabled={isPending || progress?.isRunning}
      >
        {progress?.isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {progress?.isRunning ? "Syncing..." : "Sync All Videos (Batch)"}
      </Button>

      {progress && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.isRunning
                ? `Syncing ${progress.done + 1} of ${progress.total}`
                : progress.total === 0
                ? progress.currentChannel
                : `Synced ${progress.done} channels`}
            </span>
            <span className="font-medium">
              {progress.total > 0
                ? `${Math.round((progress.done / progress.total) * 100)}%`
                : "100%"}
            </span>
          </div>

          {progress.total > 0 && (
            <Progress
              value={progress.total > 0 ? (progress.done / progress.total) * 100 : 100}
              className="h-2"
            />
          )}

          <p className="text-xs text-muted-foreground truncate">
            {progress.currentChannel}
          </p>

          {progress.done > 0 && (
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="h-3 w-3" />
                {progress.successes} OK
              </span>
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
