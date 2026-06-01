"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateVideoTags } from "@/app/actions/videos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export function VideoTags({
  videoId,
  tags,
}: {
  videoId: string;
  tags: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      await generateVideoTags(videoId);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-[10px] px-1.5 py-0 font-normal bg-secondary/30"
        >
          {tag.name}
        </Badge>
      ))}
      {tags.length === 0 && (
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
      )}
    </div>
  );
}
