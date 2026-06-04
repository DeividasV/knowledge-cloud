"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateVideoTags } from "@/app/actions/videos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

export interface ScoredTag {
  id: string;
  name: string;
  score: number;
}

function getStrongTags(tags: ScoredTag[]): ScoredTag[] {
  if (tags.length <= 4) return tags;

  const maxScore = tags[0]?.score ?? 0;
  if (maxScore <= 0) return tags.slice(0, 4);

  const threshold = maxScore * 0.3;
  const strong: ScoredTag[] = [];

  for (const tag of tags) {
    if (tag.score >= threshold && strong.length < 4) {
      strong.push(tag);
    }
  }

  if (strong.length === 0 && tags.length > 0) {
    strong.push(tags[0]);
  }

  return strong;
}

export function VideoTags({
  videoId,
  tags,
}: {
  videoId: string;
  tags: ScoredTag[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      await generateVideoTags(videoId);
      router.refresh();
    });
  };

  const strong = getStrongTags(tags);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {strong.map((tag) => (
        <Link
          key={tag.id}
          href={`/tags/${encodeURIComponent(tag.name)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-normal bg-secondary/30 cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
          >
            {tag.name}
          </Badge>
        </Link>
      ))}

      {tags.length === 0 ? (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleGenerate();
          }}
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
          onClick={(e) => {
            e.stopPropagation();
            handleGenerate();
          }}
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
