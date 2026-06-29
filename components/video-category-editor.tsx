"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVideoCategory } from "@/app/actions/videos";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X } from "lucide-react";

export function VideoCategoryEditor({
  videoId,
  category,
}: {
  videoId: string;
  category: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(category ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    const trimmed = value.trim();
    startTransition(async () => {
      await setVideoCategory(videoId, trimmed || null);
      setIsEditing(false);
      router.refresh();
    });
  };

  const handleCancel = () => {
    setValue(category ?? "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          disabled={isPending}
          className="h-6 w-32 text-xs px-2 py-0"
          placeholder="Category..."
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="p-0.5 rounded hover:bg-primary/10 text-primary"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="p-0.5 rounded hover:bg-destructive/10 text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {category ? (
        <Badge variant="secondary" className="text-xs">
          {category}
        </Badge>
      ) : null}
      <button
        onClick={() => setIsEditing(true)}
        className="p-0.5 rounded hover:bg-muted text-muted-foreground"
        title={category ? "Edit category" : "Add category"}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}
