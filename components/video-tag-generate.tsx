"use client";

import { useActionState } from "react";
import { generateVideoTags } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

async function action(_prevState: string | null | undefined, formData: FormData) {
  const videoId = formData.get("videoId") as string;
  const result = await generateVideoTags(videoId);
  if (!result.success) {
    return result.error;
  }
  return null;
}

export function VideoTagGenerate({ videoId }: { videoId: string }) {
  const [error, submitAction, isPending] = useActionState(action, null);

  return (
    <form action={submitAction} className="contents">
      <input type="hidden" name="videoId" value={videoId} />
      <Button size="sm" variant="outline" type="submit" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-1.5" />
        )}
        Generate tags
      </Button>
      {error && (
        <span className="text-sm text-destructive w-full">{error}</span>
      )}
    </form>
  );
}
