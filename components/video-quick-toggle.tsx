"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { VideoStatus } from "@/lib/types";
import { updateVideoStatus } from "@/app/actions/videos";
import { Check, Circle, Loader2 } from "lucide-react";

export function VideoQuickToggle({
  videoId,
  currentStatus,
  size = "sm",
}: {
  videoId: string;
  currentStatus: VideoStatus;
  size?: "sm" | "md";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isWatched = currentStatus === "WATCHED";

  const handleToggle = () => {
    const newStatus: VideoStatus = isWatched ? "UNWATCHED" : "WATCHED";
    startTransition(async () => {
      await updateVideoStatus(videoId, newStatus);
      router.refresh();
    });
  };

  const sizeClasses = size === "md" ? "h-6 w-6" : "h-5 w-5";

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center justify-center rounded-full border-2 transition-colors ${sizeClasses} ${
        isWatched
          ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
          : "border-muted-foreground/30 text-muted-foreground hover:border-emerald-500 hover:text-emerald-500"
      } disabled:opacity-50`}
      title={isWatched ? "Mark as unwatched" : "Mark as watched"}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isWatched ? (
        <Check className="h-3 w-3" />
      ) : (
        <Circle className="h-2 w-2 opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}
