"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PlaySquare,
  ArrowRight,
  Eye,
  EyeOff,
  XCircle,
  Loader2,
} from "lucide-react";
import { VideoStatusToggle } from "./video-status-toggle";
import { VideoTags, VideoTagAction } from "./video-tags";
import { VideoTranscriptIndicator } from "./video-transcript-indicator";
import { VideoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateVideoStatus } from "@/app/actions/videos";

export interface VideoCardData {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date;
  durationSec: number | null;
  transcript: string | null;
  videoTags: Array<{
    id: string;
    name: string;
    score: number;
  }>;
  status: VideoStatus;
}

const statusConfig: Record<
  VideoStatus,
  { label: string; badge: string }
> = {
  UNWATCHED: {
    label: "Unwatched",
    badge:
      "bg-background/80 text-muted-foreground border-border",
  },
  WATCHING: {
    label: "Watching",
    badge:
      "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700",
  },
  WATCHED: {
    label: "Watched",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700",
  },
  NOT_INTERESTED: {
    label: "Not interested",
    badge:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
  },
};

export function VideoCard({
  video,
  href,
  subtitle,
  showCheckbox = false,
  isSelected = false,
  onSelect,
}: {
  video: VideoCardData;
  href: string;
  subtitle: React.ReactNode;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic<VideoStatus, VideoStatus>(
    video.status,
    (_, nextStatus) => nextStatus
  );

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, label, textarea, [role="button"]'))
      return;
    router.push(href);
  };

  const handleStatusChange = (nextStatus: VideoStatus) => {
    startTransition(async () => {
      setOptimisticStatus(nextStatus);
      await updateVideoStatus(video.id, nextStatus);
      router.refresh();
    });
  };

  const quickActions: Array<{
    status: VideoStatus;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      status: "WATCHED",
      label: "Mark as watched",
      icon: <Eye className="h-3.5 w-3.5" />,
    },
    {
      status: "NOT_INTERESTED",
      label: "Mark as not interested",
      icon: <EyeOff className="h-3.5 w-3.5" />,
    },
    {
      status: "UNWATCHED",
      label: "Mark as unwatched",
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        "overflow-hidden group/card transition-colors cursor-pointer",
        isSelected ? "ring-2 ring-primary" : ""
      )}
    >
      {/* Thumbnail */}
      <div className="relative">
        <div className="block aspect-video bg-muted relative group/link">
          {video.thumbnail ? (
            <>
              <Image
                src={video.thumbnail}
                alt={video.title}
                fill
                className="object-cover transition-transform group-hover/link:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/link:bg-black/20 transition-colors flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-white opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <PlaySquare className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Checkbox overlay */}
        {showCheckbox && onSelect && (
          <label
            className="absolute top-2 left-2 flex items-center justify-center w-7 h-7 rounded-md bg-black/40 hover:bg-black/60 transition-colors cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(video.id)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </label>
        )}

        {/* Status badge */}
        <span
          className={cn(
            "absolute top-2 right-2 z-10 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wide backdrop-blur-sm",
            statusConfig[status].badge
          )}
        >
          {statusConfig[status].label}
        </span>

        {/* Desktop quick actions (hover) */}
        <div className="pointer-events-none hidden md:absolute md:bottom-2 md:right-2 md:z-20 md:flex md:items-center md:gap-1 md:rounded-full md:bg-black/60 md:p-1 md:backdrop-blur-sm md:opacity-0 md:group-hover/card:opacity-100 md:transition-opacity">
          {quickActions.map((action) => (
            <Button
              key={action.status}
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={action.label}
              title={action.label}
              disabled={isPending || status === action.status}
              onClick={() => handleStatusChange(action.status)}
              className="pointer-events-auto text-white hover:bg-white/20 hover:text-white"
            >
              {isPending && status !== action.status ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                action.icon
              )}
            </Button>
          ))}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <div>
          <h3
            className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors"
            title={video.title}
          >
            {video.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <VideoStatusToggle videoId={video.id} currentStatus={status} />
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <VideoTags
              videoId={video.id}
              tags={video.videoTags.map((vt) => ({
                id: vt.id,
                name: vt.name,
                score: vt.score,
              }))}
              hideActions
            />
          </div>
          <div className="flex items-center gap-0 shrink-0">
            <VideoTagAction
              videoId={video.id}
              hasTags={video.videoTags.length > 0}
            />
            <VideoTranscriptIndicator
              videoId={video.id}
              transcript={video.transcript}
            />
          </div>
        </div>

        {/* Mobile quick actions (always visible) */}
        <div className="flex md:hidden items-center gap-2 pt-1">
          {quickActions.map((action) => (
            <Button
              key={action.status}
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={action.label}
              title={action.label}
              disabled={isPending || status === action.status}
              onClick={() => handleStatusChange(action.status)}
            >
              {isPending && status !== action.status ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                action.icon
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
