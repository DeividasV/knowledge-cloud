"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addVideoByUrl } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";

export function AddVideoForm() {
  const [url, setUrl] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;

    startTransition(async () => {
      try {
        const result = await addVideoByUrl(url.trim(), standalone);
        if (result.success) {
          setUrl("");
          setStandalone(false);
          router.refresh();
        }
      } catch (e: any) {
        setError(e.message || "Failed to add video");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Paste video URL or video ID"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isPending}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <Button type="submit" disabled={isPending || !url.trim()}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </Button>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={standalone}
          onChange={(e) => setStandalone(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-muted-foreground">
          Add without subscribing to channel
        </span>
      </label>
    </form>
  );
}
