"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, Eye, Loader2 } from "lucide-react";
import { updateVideoProgress, updateVideoStatus } from "@/app/actions/videos";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoProgressEditor({
  videoId,
  progressSec,
  durationSec,
}: {
  videoId: string;
  progressSec: number;
  durationSec: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(progressSec);
  const [isPending, startTransition] = useTransition();

  const progressPercent =
    durationSec && durationSec > 0
      ? Math.min(100, Math.max(0, (value / durationSec) * 100))
      : 0;

  const handleSave = () => {
    startTransition(async () => {
      await updateVideoProgress(videoId, Math.max(0, value));
      router.refresh();
    });
  };

  const handleMarkWatched = () => {
    startTransition(async () => {
      await updateVideoStatus(videoId, "WATCHED");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Watch progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {durationSec && durationSec > 0 && (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={durationSec ?? undefined}
            value={value}
            onChange={(e) =>
              setValue(parseInt(e.target.value || "0", 10))
            }
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">
            / {durationSec ? formatDuration(durationSec) : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save progress"
            )}
          </Button>
          <Button
            onClick={handleMarkWatched}
            disabled={isPending}
            variant="outline"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Mark as watched
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
