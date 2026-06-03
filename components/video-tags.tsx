"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateVideoTags } from "@/app/actions/videos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

export interface ScoredTag {
  id: string;
  name: string;
  score: number;
}

function getStrongTags(tags: ScoredTag[]): {
  strong: ScoredTag[];
  weak: ScoredTag[];
} {
  if (tags.length <= 3) return { strong: tags, weak: [] };

  const maxScore = tags[0]?.score ?? 0;
  if (maxScore <= 0) return { strong: tags.slice(0, 3), weak: tags.slice(3) };

  // Threshold: tags with at least 30% of the top score
  const threshold = maxScore * 0.3;

  const strong: ScoredTag[] = [];
  const weak: ScoredTag[] = [];

  for (const tag of tags) {
    if (tag.score >= threshold && strong.length < 5) {
      strong.push(tag);
    } else {
      weak.push(tag);
    }
  }

  // Ensure at least 2 tags shown if available
  if (strong.length < 2 && tags.length >= 2) {
    const needed = 2 - strong.length;
    strong.push(...weak.splice(0, needed));
  }

  return { strong, weak };
}

export function VideoTags({
  videoId,
  tags,
}: {
  videoId: string;
  tags: ScoredTag[];
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      await generateVideoTags(videoId);
      router.refresh();
    });
  };

  const { strong, weak } = getStrongTags(tags);
  const hasWeak = weak.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(expanded ? tags : strong).map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-[10px] px-1.5 py-0 font-normal bg-secondary/30"
        >
          {tag.name}
          {expanded && (
            <span className="text-muted-foreground ml-1 tabular-nums">
              {tag.score.toFixed(2)}
            </span>
          )}
        </Badge>
      ))}

      {!expanded && hasWeak && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3 mr-0.5" />
          +{weak.length}
        </Button>
      )}

      {expanded && hasWeak && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="h-3 w-3 mr-0.5" />
          Less
        </Button>
      )}

      {tags.length === 0 ? (
        <Button
          onClick={handleGenerate}
          disabled={isPending}
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          Generate tags
        </Button>
      ) : (
        <Button
          onClick={handleGenerate}
          disabled={isPending}
          variant="ghost"
          size="sm"
          title="Regenerate tags"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}
