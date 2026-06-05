"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PlaySquare, ArrowRight } from "lucide-react";
import { VideoStatusToggle } from "./video-status-toggle";
import { VideoTags, VideoTagAction } from "./video-tags";
import { VideoTranscriptIndicator } from "./video-transcript-indicator";
import { VideoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, label, textarea, [role="button"]')) return;
    router.push(href);
  };

  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        "overflow-hidden group transition-colors cursor-pointer",
        isSelected ? "ring-2 ring-primary" : ""
      )}
    >
      {/* Thumbnail */}
      <div className="relative">
        <div className="block aspect-video bg-muted relative group/link">
          {video.thumbnail ? (
            <>
              <img
                src={video.thumbnail}
                alt={video.title}
                className="h-full w-full object-cover transition-transform group-hover/link:scale-105"
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
        <VideoStatusToggle videoId={video.id} currentStatus={video.status} />
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
      </CardContent>
    </Card>
  );
}
