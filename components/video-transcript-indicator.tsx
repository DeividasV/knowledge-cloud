"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchAndStoreTranscript } from "@/app/actions/videos";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function VideoTranscriptIndicator({
  videoId,
  transcript,
}: {
  videoId: string;
  transcript: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleFetch = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const result = await fetchAndStoreTranscript(videoId);
        if (result.success) {
          router.refresh();
        }
      } catch {
        // silent fail
      }
    });
  };

  if (transcript) {
    return (
      <span
        className="inline-flex items-center text-emerald-500"
        title="Transcript available"
      >
        <FileText className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <button
      onClick={handleFetch}
      disabled={isPending}
      className={cn(
        "inline-flex items-center text-muted-foreground hover:text-foreground transition-colors",
        isPending && "opacity-50 cursor-not-allowed"
      )}
      title={isPending ? "Fetching transcript..." : "Fetch transcript"}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
