"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getTagExtractionMethodSetting,
  setTagExtractionMethodSetting,
} from "@/app/actions/videos";
import { Loader2, BrainCircuit, Cloud } from "lucide-react";

const METHOD_OPTIONS = [
  { value: "ollama", label: "Ollama (local)", icon: BrainCircuit },
  { value: "gemini", label: "Gemini (cloud)", icon: Cloud },
];

export function TagExtractionSettings({
  initialMethod,
}: {
  initialMethod: string;
}) {
  const [method, setMethod] = useState(initialMethod);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setMethod(value);
    setSaved(false);
    startTransition(async () => {
      await setTagExtractionMethodSetting(value);
      setSaved(true);
      router.refresh();
    });
  }

  const selected = METHOD_OPTIONS.find((o) => o.value === method);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        {selected && (
          <selected.icon className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-medium">Tag extraction backend</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={method}
          onChange={handleChange}
          disabled={isPending}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {saved && !isPending && (
          <span className="text-xs text-green-600">Saved</span>
        )}
      </div>
    </div>
  );
}
