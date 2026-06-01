"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addChannelCategory, removeChannelCategory } from "@/app/actions/videos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";

export function ChannelCategoryManager({
  channelId,
  categories,
  allCategories,
}: {
  channelId: string;
  categories: { id: string; name: string }[];
  allCategories: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [newCategory, setNewCategory] = useState("");

  const handleRemove = (name: string) => {
    startTransition(async () => {
      await removeChannelCategory(channelId, name);
      router.refresh();
    });
  };

  const handleAdd = (name: string) => {
    if (!name.trim()) return;
    setNewCategory("");
    startTransition(async () => {
      await addChannelCategory(channelId, name);
      router.refresh();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd(newCategory);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <Badge
            key={cat.id}
            variant="secondary"
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5"
          >
            {cat.name}
            <button
              onClick={() => handleRemove(cat.name)}
              disabled={isPending}
              className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
              title={`Remove ${cat.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {categories.length === 0 && (
          <span className="text-xs text-muted-foreground">No categories</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add category..."
          disabled={isPending}
          className="h-7 w-40 text-xs"
          list="existing-categories"
        />
        <datalist id="existing-categories">
          {allCategories
            .filter((c) => !categories.some((cc) => cc.name === c.name))
            .map((c) => (
              <option key={c.id} value={c.name} />
            ))}
        </datalist>
        <Button
          onClick={() => handleAdd(newCategory)}
          disabled={isPending || !newCategory.trim()}
          size="sm"
          className="h-7 px-2 text-xs"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
