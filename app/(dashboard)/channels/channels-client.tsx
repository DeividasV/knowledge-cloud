"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  count: number;
}

export function CategoryFilter({
  categories,
  totalChannels,
  currentCategory,
}: {
  categories: Category[];
  totalChannels: number;
  currentCategory: string | null;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/channels"
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          !currentCategory
            ? "bg-primary text-primary-foreground border-primary"
            : "border-input bg-background text-foreground hover:bg-accent"
        )}
      >
        All ({totalChannels})
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/channels?category=${encodeURIComponent(cat.name)}`}
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            currentCategory === cat.name
              ? "bg-primary text-primary-foreground border-primary"
              : "border-input bg-background text-foreground hover:bg-accent"
          )}
        >
          {cat.name} ({cat.count})
        </Link>
      ))}
    </div>
  );
}
