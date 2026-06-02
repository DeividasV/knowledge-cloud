"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMaxVideosSetting } from "@/app/actions/videos";
import { Loader2, Clapperboard } from "lucide-react";

const VIDEO_OPTIONS = [100, 200, 500, 1000, 2000, 5000];

export function SyncSettings({ initialMaxVideos }: { initialMaxVideos: number }) {
  const [maxVideos, setMaxVideos] = useState(String(initialMaxVideos));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setMaxVideos(value);
    setSaved(false);
    startTransition(async () => {
      await setMaxVideosSetting(Number(value));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Clapperboard className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Max videos per channel sync</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={maxVideos}
          onChange={handleChange}
          disabled={isPending}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {VIDEO_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {saved && !isPending && (
          <span className="text-xs text-green-600">Saved</span>
        )}
      </div>
    </div>
  );
}
