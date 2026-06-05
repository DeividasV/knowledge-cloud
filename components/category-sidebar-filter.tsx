"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { setSelectedCategory } from "@/app/actions/videos";
import { Check, Tag } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

export function CategorySidebarFilter({
  categories,
  selectedCategory,
}: {
  categories: Category[];
  selectedCategory: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  if (categories.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Category
        </span>
        {isPending && (
          <span className="text-xs text-muted-foreground animate-pulse">
            saving…
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <button
          onClick={() =>
            startTransition(() => setSelectedCategory(null))
          }
          disabled={isPending}
          className={cn(
            "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors text-left",
            !selectedCategory
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <span>All</span>
          {!selectedCategory && <Check className="h-3.5 w-3.5" />}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() =>
              startTransition(() => setSelectedCategory(cat.name))
            }
            disabled={isPending}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors text-left",
              selectedCategory === cat.name
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <span className="truncate">{cat.name}</span>
            {selectedCategory === cat.name && (
              <Check className="h-3.5 w-3.5 shrink-0 ml-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
