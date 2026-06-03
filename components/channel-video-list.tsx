"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PlaySquare,
  ArrowRight,
  Trash2,
  Loader2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { VideoStatusToggle } from "@/components/video-status-toggle";
import { VideoQuickToggle } from "@/components/video-quick-toggle";
import { VideoTranscript } from "@/components/video-transcript";
import { VideoTags } from "@/components/video-tags";
import { VideoStatus } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { deleteVideoTags } from "@/app/actions/videos";

interface VideoItem {
  id: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date;
  durationSec: number | null;
  category: string | null;
  transcript: string | null;
  videoTags: Array<{
    tag: { id: string; name: string };
    score: number;
  }>;
  userStates: Array<{
    status: string;
  }>;
}

interface ChannelVideoListProps {
  channelId: string;
  videos: VideoItem[];
  page: number;
  totalPages: number;

  query?: string;
}

export function ChannelVideoList({
  channelId,
  videos,
  page,
  totalPages,
  query,
}: ChannelVideoListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const hasSelection = selected.size > 0;
  const allSelected = videos.length > 0 && videos.every((v) => selected.has(v.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(videos.map((v) => v.id)));
    }
  };

  const handleDeleteTags = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await deleteVideoTags(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  };

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {query ? `No videos matching "${query}".` : "No videos found."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="h-7 gap-1.5 text-xs"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteTags}
              disabled={isPending}
              className="h-7 gap-1.5 text-xs"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete tags
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="h-7 px-1.5"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Select all / none when nothing selected but there are items */}
      {!hasSelection && videos.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Square className="h-4 w-4" />
            Select all on page
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => {
          const status =
            (video.userStates[0]?.status as VideoStatus) || "UNWATCHED";
          const isSelected = selected.has(video.id);

          return (
            <Card
              key={video.id}
              className={`overflow-hidden group transition-colors ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
            >
              {/* Thumbnail with checkbox */}
              <div className="relative">
                <Link
                  href={`/videos/${video.id}`}
                  className="block aspect-video bg-muted relative group/link"
                >
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
                  <div className="absolute top-2 right-2">
                    <VideoQuickToggle videoId={video.id} currentStatus={status} />
                  </div>
                </Link>

                {/* Checkbox overlay */}
                <label className="absolute top-2 left-2 flex items-center justify-center w-7 h-7 rounded-md bg-black/40 hover:bg-black/60 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(video.id)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </label>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <Link href={`/videos/${video.id}`}>
                    <h3
                      className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors"
                      title={video.title}
                    >
                      {video.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.category ? `${video.category} · ` : ""}
                    {new Date(video.publishedAt).toLocaleDateString()}
                    {video.durationSec ? (
                      <span className="ml-2">
                        {Math.floor(video.durationSec / 60)}:
                        {String(video.durationSec % 60).padStart(2, "0")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <VideoStatusToggle videoId={video.id} currentStatus={status} />
                <VideoTags
                  videoId={video.id}
                  tags={video.videoTags.map((vt) => ({
                    id: vt.tag.id,
                    name: vt.tag.name,
                    score: vt.score,
                  }))}
                />
                <VideoTranscript
                  videoId={video.id}
                  transcript={video.transcript}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath={`/channels/${channelId}`}
      />
    </div>
  );
}
