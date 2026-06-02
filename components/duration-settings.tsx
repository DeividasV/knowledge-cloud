"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMinDurationSetting } from "@/app/actions/videos";
import { Loader2, Timer } from "lucide-react";

const DURATION_OPTIONS = [
  { value: 0, label: "No minimum" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
];

export function DurationSettings({ initialMinDuration }: { initialMinDuration: number }) {
  const [minDuration, setMinDuration] = useState(String(initialMinDuration));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setMinDuration(value);
    setSaved(false);
    startTransition(async () => {
      await setMinDurationSetting(Number(value));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Skip videos shorter than</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={minDuration}
          onChange={handleChange}
          disabled={isPending}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
