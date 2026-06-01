"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setMaxTagsSetting, getTagStats } from "@/app/actions/videos";
import { TagBulkGenerate } from "./tag-bulk-generate";
import { Loader2, Settings2 } from "lucide-react";

const TAG_OPTIONS = [3, 5, 8, 10, 15, 20, 30, 50];

export function TagSettings({ initialMaxTags }: { initialMaxTags: number }) {
  const [maxTags, setMaxTags] = useState(String(initialMaxTags));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<{ totalTags: number; taggedVideos: number; untaggedVideos: number } | null>(null);
  const router = useRouter();

  async function loadStats() {
    const s = await getTagStats();
    setStats(s);
  }

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setMaxTags(value);
    setSaved(false);
    startTransition(async () => {
      await setMaxTagsSetting(Number(value));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{stats.totalTags}</div>
            <div className="text-xs text-muted-foreground">Total tags</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{stats.taggedVideos}</div>
            <div className="text-xs text-muted-foreground">Tagged</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{stats.untaggedVideos}</div>
            <div className="text-xs text-muted-foreground">Untagged</div>
          </div>
        </div>
      )}

      {/* Max tags setting */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">Tags per video</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={maxTags}
            onChange={handleChange}
            disabled={isPending}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {TAG_OPTIONS.map((n) => (
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

      <TagBulkGenerate />
    </div>
  );
}
