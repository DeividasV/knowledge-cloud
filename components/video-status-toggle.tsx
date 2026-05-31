"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { VideoStatus } from "@/lib/types";
import { updateVideoStatus } from "@/app/actions/videos";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Eye, EyeOff, PlayCircle } from "lucide-react";

const statusConfig: Record<
  VideoStatus,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" }
> = {
  UNWATCHED: {
    label: "Unwatched",
    icon: <EyeOff className="mr-2 h-4 w-4" />,
    variant: "outline",
  },
  WATCHING: {
    label: "Watching",
    icon: <PlayCircle className="mr-2 h-4 w-4" />,
    variant: "secondary",
  },
  WATCHED: {
    label: "Watched",
    icon: <Eye className="mr-2 h-4 w-4" />,
    variant: "default",
  },
};

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

  const config = statusConfig[currentStatus];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 min-w-[120px] h-7 px-2.5 gap-1"
        disabled={isPending}
      >
        {config.icon}
        {config.label}
        <ChevronDown className="ml-2 h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(statusConfig) as VideoStatus[]).map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleChange(status)}
            className="flex items-center"
          >
            {status === currentStatus && <Check className="mr-2 h-4 w-4" />}
            {statusConfig[status].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
