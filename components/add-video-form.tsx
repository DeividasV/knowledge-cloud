"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addVideoByUrl } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";

export function AddVideoForm() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;

    startTransition(async () => {
      try {
        const result = await addVideoByUrl(url.trim());
        if (result.success) {
          setUrl("");
          router.refresh();
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to add video";
        setError(message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
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
    </form>
  );
}
