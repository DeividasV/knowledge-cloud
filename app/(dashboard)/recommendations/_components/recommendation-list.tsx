"use client";

import { useMemo, useState } from "react";
import { VideoCard } from "@/components/video-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { VideoStatus } from "@/lib/types";
import type { RecommendedVideo } from "@/app/actions/recommendations";

const BATCH_SIZE = 12;

interface RecommendationListProps {
  recommendations: RecommendedVideo[];
  selectedCategory?: string | null;
}

export function RecommendationList({
  recommendations,
  selectedCategory,
}: RecommendationListProps) {
  const allReasons = useMemo(() => {
    const reasons = new Set<string>();
    for (const video of recommendations) {
      for (const reason of video.reasons) {
        reasons.add(reason);
      }
    }
    return Array.from(reasons).sort((a, b) => a.localeCompare(b));
  }, [recommendations]);

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const filtered = useMemo(() => {
    if (!selectedReason) return recommendations;
    return recommendations.filter((video) =>
      video.reasons.includes(selectedReason)
    );
  }, [recommendations, selectedReason]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function selectReason(reason: string | null) {
    setSelectedReason(reason);
    setVisibleCount(BATCH_SIZE);
  }

  return (
    <div className="space-y-6">
      {allReasons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            key="all"
            variant={selectedReason === null ? "default" : "outline"}
            render={<button type="button" />}
            onClick={() => selectReason(null)}
          >
            All
          </Badge>
          {allReasons.map((reason) => (
            <Badge
              key={reason}
              variant={selectedReason === reason ? "default" : "outline"}
              render={<button type="button" />}
              onClick={() => selectReason(reason)}
            >
              {reason}
            </Badge>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">
            No recommendations match &quot;{selectedReason}&quot;
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {selectedCategory && (
              <>
                You are also filtering by &quot;{selectedCategory}&quot;.{" "}
              </>
            )}
            Try another reason or clear the filter.
          </p>
          <Button className="mt-4" onClick={() => selectReason(null)}>
            Clear filter
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((video) => (
              <div key={video.id} className="space-y-1.5">
                <VideoCard
                  video={{
                    id: video.id,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    publishedAt: video.publishedAt,
                    durationSec: video.durationSec,
                    transcript: null,
                    videoTags: video.videoTags,
                    status: video.status as VideoStatus,
                  }}
                  href={`/videos/${video.id}?from=${encodeURIComponent("/recommendations")}`}
                  subtitle={
                    <>
                      {video.channel?.title ?? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Standalone
                        </span>
                      )}
                      · {new Date(video.publishedAt).toLocaleDateString()}
                      {video.durationSec ? (
                        <span className="ml-2">
                          {Math.floor(video.durationSec / 60)}:
                          {String(video.durationSec % 60).padStart(2, "0")}
                        </span>
                      ) : null}
                    </>
                  }
                />
                {video.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {video.reasons.map((reason) => (
                      <Badge
                        key={reason}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-primary/5 border-primary/20"
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((count) => count + BATCH_SIZE)}
              >
                Load more ({filtered.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
