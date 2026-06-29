"use client";

import { useState, useTransition } from "react";
import { fetchAndStoreTranscript } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";

export function VideoTranscriptStatic({
  videoId,
  transcript,
}: {
  videoId: string;
  transcript: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [localTranscript] = useState(transcript);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchAndStoreTranscript(videoId);
        if (result.success) {
          window.location.reload();
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to fetch transcript.";
        setError(message);
      }
    });
  };

  if (localTranscript) {
    return (
      <Textarea
        readOnly
        value={localTranscript}
        className="min-h-[200px] text-xs resize-none"
      />
    );
  }

  return (
    <div className="text-sm text-muted-foreground space-y-3">
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <p>No transcript stored for this video yet.</p>
      )}
      <Button
        onClick={handleFetch}
        disabled={isPending}
        size="sm"
        variant="outline"
      >
        {isPending ? (
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="mr-1.5 h-3 w-3" />
        )}
        Fetch transcript
      </Button>
    </div>
  );
}
