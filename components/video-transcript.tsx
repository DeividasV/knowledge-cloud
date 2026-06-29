"use client";

import { useState, useTransition } from "react";
import { fetchAndStoreTranscript } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, RefreshCw } from "lucide-react";

export function VideoTranscript({
  videoId,
  transcript,
}: {
  videoId: string;
  transcript: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [localTranscript] = useState(transcript);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchAndStoreTranscript(videoId);
        if (result.success) {
          // Force a refresh to get the updated transcript from the server
          window.location.reload();
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to fetch transcript.";
        setError(message);
      }
    });
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        {localTranscript
          ? isOpen
            ? "Hide transcript"
            : "Show transcript"
          : "Transcript not available"}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {localTranscript ? (
            <Textarea
              readOnly
              value={localTranscript}
              className="min-h-[120px] text-xs resize-none"
            />
          ) : (
            <div className="text-xs text-muted-foreground">
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
                className="mt-2"
              >
                {isPending ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                )}
                Fetch transcript
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
