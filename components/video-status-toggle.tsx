"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { VideoStatus } from "@/lib/types";
import { updateVideoStatus } from "@/app/actions/videos";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type StatusConfig = {
  status: VideoStatus;
  label: string;
  activeClass: string;
};

const statusConfigs: StatusConfig[] = [
  {
    status: "UNWATCHED",
    label: "Unwatched",
    activeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  },
  {
    status: "WATCHED",
    label: "Watched",
    activeClass:
      "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700",
  },
  {
    status: "NOT_INTERESTED",
    label: "Not interested",
    activeClass:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
  },
];

export function VideoStatusToggle({
  videoId,
  currentStatus,
}: {
  videoId: string;
  currentStatus: VideoStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleChange = (status: VideoStatus) => {
    startTransition(async () => {
      await updateVideoStatus(videoId, status);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      {statusConfigs.map((config) => {
        const isActive = currentStatus === config.status;
        return (
          <button
            key={config.status}
            onClick={() => handleChange(config.status)}
            disabled={isPending}
            className={cn(
              "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? config.activeClass
                : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
              isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            {isPending && currentStatus !== config.status ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
